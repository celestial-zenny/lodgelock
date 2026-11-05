import { z } from "zod";
import { BANK_CODES } from "./banks";

/** How long a granted KYC consent stays usable for a submission. */
export const CONSENT_WINDOW_MS = 60 * 60 * 1000;

export const KycDetails = z.object({
  nin: z.string().trim().regex(/^\d{11}$/, "Your NIN is 11 digits"),
  bvn: z.string().trim().regex(/^\d{11}$/, "Your BVN is 11 digits"),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account numbers (NUBAN) are 10 digits"),
  bankCode: z.string().refine((c) => BANK_CODES.has(c), "Choose your bank"),
});
export type KycDetailsInput = z.infer<typeof KycDetails>;

/** First and last name from the profile; KYC needs both. */
export function splitName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}
