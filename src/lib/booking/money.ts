import { z } from "zod";

// All money is integer kobo. Never use floats for amounts.
export const Kobo = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Max agent fee as a fraction of rent. Keep in sync with lodges.agent_fee_cap in the migration. */
export const AGENT_FEE_CAP_DIVISOR = 20; // 5%

export function maxAgentFeeKobo(rentKobo: number): number {
  return Math.floor(rentKobo / AGENT_FEE_CAP_DIVISOR);
}

/**
 * Optional commitment fee: a lodge may set 10-20% of rent, released to the landlord at payment (not held, not
 * refundable through the hold). 0 = off. Keep in sync with lodges.commitment_fee_pct_range and bookings_guard (0005/0007).
 */
export const COMMITMENT_FEE_MIN_PCT = 10;
export const COMMITMENT_FEE_MAX_PCT = 20;
export const CommitmentFeePct = z
  .number()
  .int()
  .refine((p) => p === 0 || (p >= COMMITMENT_FEE_MIN_PCT && p <= COMMITMENT_FEE_MAX_PCT), {
    message: `Commitment fee must be 0 (off) or ${COMMITMENT_FEE_MIN_PCT}-${COMMITMENT_FEE_MAX_PCT}% of rent`,
  });

/** Same integer maths as the DB: rounds down to whole kobo. */
export function commitmentFeeKobo(rentKobo: number, pct: number): number {
  return Math.floor((rentKobo * pct) / 100);
}

/** Landlord-paid commission to the lodge's agent, deducted from the landlord's rent. Lodge-declared, 0-10%. */
export const LANDLORD_COMMISSION_DEFAULT_PCT = 5;
export const LANDLORD_COMMISSION_MAX_PCT = 10;
/** Renewal through LodgeLock: the linked agent earns 2.5% of the new rent (in basis points), instead of a commission. */
export const RENEWAL_BONUS_BPS = 250;
/** Student-fault cancellation after the grace period, or no-show: landlord receives this share of rent. */
export const LATE_CANCEL_COMPENSATION_PCT = 10;

/** The money terms snapshotted on a booking (mirrors private.bookings_guard, 0007). Integer kobo. */
export type BookingTerms = {
  rentKobo: number;
  agentFeeKobo: number;          // student-paid, 0 without an agent or on renewal
  agentCommissionKobo: number;   // landlord-paid: commission, or renewal bonus on renewals
  commitmentFeeKobo: number;     // released to the landlord at payment
  hasAgent: boolean;
};

export function bookingTerms(input: {
  rentKobo: number;
  agentFeeKobo: number;
  hasAgent: boolean;
  commitmentFeePct: number;
  landlordCommissionPct: number;
  isRenewal: boolean;
}): BookingTerms {
  const { rentKobo, hasAgent, isRenewal } = input;
  return {
    rentKobo,
    hasAgent,
    commitmentFeeKobo: Math.floor((rentKobo * input.commitmentFeePct) / 100),
    agentFeeKobo: !hasAgent || isRenewal ? 0 : input.agentFeeKobo,
    agentCommissionKobo: !hasAgent
      ? 0
      : isRenewal
        ? Math.floor((rentKobo * RENEWAL_BONUS_BPS) / 10_000)
        : Math.floor((rentKobo * input.landlordCommissionPct) / 100),
  };
}

/** What the student pays (one payment). */
export const totalPaidKobo = (t: BookingTerms) => t.rentKobo + t.agentFeeKobo;
/** What stays held after payment (the commitment fee goes to the landlord immediately). */
export const heldKobo = (t: BookingTerms) => t.rentKobo - t.commitmentFeeKobo + t.agentFeeKobo;

/** Split of the held amount at release (mirrors private.book_release). */
export function releaseSplit(t: BookingTerms) {
  const rentToPayee = t.rentKobo - t.commitmentFeeKobo - t.agentCommissionKobo;
  const toAgent = t.hasAgent ? t.agentFeeKobo + t.agentCommissionKobo : 0;
  return { rentToPayee, agentFee: t.agentFeeKobo, agentCommission: t.agentCommissionKobo, toAgent };
}

/** Split of the held amount when the student cancels (mirrors private.book_cancellation). */
export function cancellationSplit(t: BookingTerms, kind: "grace" | "late" | "no_show") {
  const compensation =
    kind === "grace"
      ? 0
      : Math.max(0, Math.floor(t.rentKobo / (100 / LATE_CANCEL_COMPENSATION_PCT)) - t.commitmentFeeKobo);
  return { compensation, refund: heldKobo(t) - compensation };
}

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: kobo % 100 === 0 ? 0 : 2,
  }).format(kobo / 100);
}

export const LodgePriceInput = z
  .object({ rentKobo: Kobo.positive(), agentFeeKobo: Kobo })
  .refine((v) => v.agentFeeKobo <= maxAgentFeeKobo(v.rentKobo), {
    message: `Agent fee cannot exceed ${100 / AGENT_FEE_CAP_DIVISOR}% of rent`,
    path: ["agentFeeKobo"],
  });
