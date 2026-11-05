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
 * refundable through the hold). 0 = off. Keep in sync with lodges.commitment_fee_pct_range and bookings_guard (0005).
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
