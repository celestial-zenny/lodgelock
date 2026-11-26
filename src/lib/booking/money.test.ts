// Unit tests for the TypeScript mirror of the booking money rules. The DB is the enforcer; these keep the
// UI's numbers identical to it (same cases as supabase/tests/money_paths.sql). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_FEE_CAP_BPS, AGENT_FEE_CAP_PCT, LodgePriceInput, agentFeeWithinCap, bookingTerms, cancellationSplit,
  commitmentFeeKobo, heldKobo, maxAgentFeeKobo, releaseSplit, totalPaidKobo, type BookingTerms,
} from "./money.ts";

const R = 30_000_000; // ₦300,000 in kobo
const F = 2_400_000;  // 8% student-paid agent fee (the cap)
const base = { rentKobo: R, agentFeeKobo: F, hasAgent: true, commitmentFeePct: 0, landlordCommissionPct: 5, isRenewal: false };

/** Every path must account for exactly what the student paid: nothing created, nothing lost. */
function assertConserved(t: BookingTerms) {
  const r = releaseSplit(t);
  assert.equal(t.commitmentFeeKobo + r.rentToPayee + r.toAgent, totalPaidKobo(t), "release conserves money");
  for (const kind of ["grace", "late", "no_show"] as const) {
    const c = cancellationSplit(t, kind);
    assert.equal(t.commitmentFeeKobo + c.compensation + c.refund, totalPaidKobo(t), `${kind} conserves money`);
    assert.ok(c.compensation >= 0 && c.refund >= 0, `${kind} non-negative`);
  }
  for (const v of [t.rentKobo, t.agentFeeKobo, t.agentCommissionKobo, t.commitmentFeeKobo, r.rentToPayee]) {
    assert.ok(Number.isInteger(v) && v >= 0, "integer kobo");
  }
}

test("agent fee cap is 8% of rent, same integer check as lodges.agent_fee_cap", () => {
  assert.equal(AGENT_FEE_CAP_BPS, 800);
  assert.equal(AGENT_FEE_CAP_PCT, 8);
  assert.equal(maxAgentFeeKobo(R), 2_400_000);
  assert.ok(agentFeeWithinCap(2_400_000, R), "exactly 8% is allowed");
  assert.ok(!agentFeeWithinCap(2_400_001, R), "one kobo over 8% is rejected");
  assert.ok(agentFeeWithinCap(0, R));
  // Mirrors the DB constraint (agent_fee_kobo * 100 <= rent_kobo * 8) for awkward rents.
  for (const rent of [1, 12, 13, 99, 15_000_001, 24_999_999, 33_333_333]) {
    const max = maxAgentFeeKobo(rent);
    assert.ok(max * 100 <= rent * 8 && (max + 1) * 100 > rent * 8, `max fee for ${rent}`);
    assert.equal(agentFeeWithinCap(max, rent), true);
    assert.equal(agentFeeWithinCap(max + 1, rent), false);
  }
  assert.equal(LodgePriceInput.safeParse({ rentKobo: R, agentFeeKobo: 2_400_000 }).success, true);
  assert.equal(LodgePriceInput.safeParse({ rentKobo: R, agentFeeKobo: 2_400_001 }).success, false);
});

test("standard release: landlord gets rent minus 5% commission; agent gets fee + commission", () => {
  const t = bookingTerms(base);
  assert.equal(totalPaidKobo(t), R + F);
  assert.deepEqual(releaseSplit(t), { rentToPayee: R - 1_500_000, agentFee: F, agentCommission: 1_500_000, toAgent: 3_900_000 });
  assertConserved(t);
});

test("commitment fee is paid at payment and netted out of the release", () => {
  const t = bookingTerms({ ...base, commitmentFeePct: 10 });
  assert.equal(t.commitmentFeeKobo, 3_000_000);
  assert.equal(heldKobo(t), R - 3_000_000 + F);
  assert.equal(releaseSplit(t).rentToPayee, R - 3_000_000 - 1_500_000);
  assertConserved(t);
});

test("direct listing: no agent fee, no commission, landlord gets all rent", () => {
  const t = bookingTerms({ ...base, hasAgent: false });
  assert.equal(t.agentFeeKobo, 0);
  assert.equal(t.agentCommissionKobo, 0);
  assert.equal(releaseSplit(t).rentToPayee, R);
  assert.equal(releaseSplit(t).toAgent, 0);
  assertConserved(t);
});

test("renewal: no student agent fee; agent earns 2.5% of new rent from the landlord's share", () => {
  const t = bookingTerms({ ...base, isRenewal: true });
  assert.equal(t.agentFeeKobo, 0);
  assert.equal(t.agentCommissionKobo, 750_000);
  assert.equal(totalPaidKobo(t), R);
  assert.equal(releaseSplit(t).rentToPayee, R - 750_000);
  assertConserved(t);
});

test("cancellation: grace refunds everything held; late/no-show pay the landlord 10% of rent", () => {
  const t = bookingTerms(base);
  assert.deepEqual(cancellationSplit(t, "grace"), { compensation: 0, refund: R + F });
  assert.deepEqual(cancellationSplit(t, "late"), { compensation: R / 10, refund: R + F - R / 10 });
  assert.deepEqual(cancellationSplit(t, "no_show"), cancellationSplit(t, "late"));
});

test("late cancellation: a commitment fee already paid counts towards the 10%", () => {
  const t10 = bookingTerms({ ...base, commitmentFeePct: 10 });
  assert.equal(cancellationSplit(t10, "late").compensation, 0);
  assert.equal(cancellationSplit(t10, "late").refund, heldKobo(t10));
  const t20 = bookingTerms({ ...base, commitmentFeePct: 20 });
  assert.equal(cancellationSplit(t20, "late").compensation, 0);
});

test("odd amounts round down to whole kobo and still balance", () => {
  for (const rent of [15_000_001, 24_999_999, 33_333_333, 1]) {
    for (const commitmentFeePct of [0, 10, 15, 20]) {
      for (const landlordCommissionPct of [0, 3, 5, 10]) {
        for (const isRenewal of [false, true]) {
          const t = bookingTerms({ rentKobo: rent, agentFeeKobo: maxAgentFeeKobo(rent), hasAgent: true,
                                   commitmentFeePct, landlordCommissionPct, isRenewal });
          assert.equal(t.commitmentFeeKobo, commitmentFeeKobo(rent, commitmentFeePct));
          assertConserved(t);
        }
      }
    }
  }
});
