import { z } from "zod";

/** Bump when the privacy policy / terms change materially; stored with each consent. */
export const POLICY_VERSION = "2026-11-04";

/** NDPA 2023: a "child" is under 18. Below MIN_AGE we don't allow sign-up at all. */
export const ADULT_AGE = 18;
export const MIN_AGE = 15;

/** Age in whole years on `today` (both as YYYY-MM-DD, Lagos calendar date). */
export function ageOn(dob: string, today: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export function todayInLagos(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}

/** Accepts 0803..., 803..., +234803..., 234803... and returns +234XXXXXXXXXX. */
export function normalizeNgPhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  const m = digits.match(/^(?:\+?234|0)?([789][01]\d{8})$/);
  return m ? `+234${m[1]}` : null;
}

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeNgPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian phone number" });
      return z.NEVER;
    }
    return n;
  });

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const SignupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.email("Enter a valid email").max(254).transform((v) => v.toLowerCase()),
    password: z.string().min(8, "Use at least 8 characters").max(72),
    phone: z.union([z.literal("").transform(() => undefined), phone]).optional(),
    role: z.enum(["student", "landlord", "agent"]).default("student"),
    dob: z.iso.date("Enter your date of birth"),
    guardianName: z.string().trim().max(120).optional(),
    guardianPhone: z.string().trim().optional(),
    guardianRelationship: z.enum(["parent", "legal_guardian"]).optional(),
    guardianConsent: checkbox.optional(),
    acceptTerms: checkbox.refine((v) => v, "You must accept the Terms and Privacy Policy"),
  })
  .transform((v, ctx) => {
    const age = ageOn(v.dob, todayInLagos());
    if (age < MIN_AGE || age > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["dob"],
        message: age < MIN_AGE ? `You must be at least ${MIN_AGE} to use LodgeLock` : "Check your date of birth",
      });
      return z.NEVER;
    }
    const isAdult = age >= ADULT_AGE;
    if (!isAdult) {
      if (v.role !== "student") {
        ctx.addIssue({ code: "custom", path: ["role"], message: "Landlords and agents must be 18 or older" });
      }
      if (!v.guardianName || v.guardianName.length < 2) {
        ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Enter your parent or guardian's name" });
      }
      const gp = v.guardianPhone ? normalizeNgPhone(v.guardianPhone) : null;
      if (!gp) {
        ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Enter your guardian's phone number" });
      }
      if (!v.guardianRelationship) {
        ctx.addIssue({ code: "custom", path: ["guardianRelationship"], message: "Choose a relationship" });
      }
      if (!v.guardianConsent) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianConsent"],
          message: "Your parent or guardian must consent before you can sign up",
        });
      }
      if (ctx.issues.length) return z.NEVER;
      return { ...v, isAdult, guardianPhone: gp! };
    }
    // Adults: drop any guardian fields that were sent.
    return {
      ...v,
      isAdult,
      guardianName: undefined,
      guardianPhone: undefined,
      guardianRelationship: undefined,
    };
  });

export type SignupInput = z.output<typeof SignupSchema>;

export type SignupFieldErrors = Partial<Record<keyof z.input<typeof SignupSchema>, string>>;
