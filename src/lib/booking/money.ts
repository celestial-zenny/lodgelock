import { z } from "zod";

// All money is integer kobo. Never use floats for amounts.
export const Kobo = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Max agent fee as a fraction of rent. Keep in sync with lodges.agent_fee_cap in the migration. */
export const AGENT_FEE_CAP_DIVISOR = 10; // 10%

export function maxAgentFeeKobo(rentKobo: number): number {
  return Math.floor(rentKobo / AGENT_FEE_CAP_DIVISOR);
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
