"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { POLICY_VERSION, SignupSchema, type SignupFieldErrors } from "@/lib/auth/signup-schema";
import { siteUrl } from "@/lib/auth/redirects";

export type SignupState = {
  formError?: string;
  fieldErrors?: SignupFieldErrors;
  /** Echo non-secret fields back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
} | null;

const ECHO_FIELDS = [
  "fullName", "email", "phone", "role", "dob",
  "guardianName", "guardianPhone", "guardianRelationship", "guardianConsent", "acceptTerms",
];

export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData);
  const values = Object.fromEntries(
    ECHO_FIELDS.filter((k) => typeof raw[k] === "string").map((k) => [k, raw[k] as string]),
  );

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
    const fieldErrors = Object.fromEntries(
      Object.entries(fe).map(([k, v]) => [k, v?.[0]]),
    ) as SignupFieldErrors;
    return { fieldErrors, values };
  }
  const v = parsed.data;

  // The date of birth is used only to compute isAdult above. It is not stored or logged.
  const supabase = await createUserClient();
  const origin = siteUrl((await headers()).get("origin"));
  const { error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/lodges`,
      data: {
        full_name: v.fullName,
        phone: v.phone ?? "",
        role: v.role,
        is_adult: v.isAdult,
        accepted_terms: true,
        policy_version: POLICY_VERSION,
        ...(v.isAdult
          ? {}
          : {
              guardian_name: v.guardianName,
              guardian_phone: v.guardianPhone,
              guardian_relationship: v.guardianRelationship,
            }),
      },
    },
  });

  if (error) {
    if (error.status === 429) {
      return { formError: "Too many sign-up attempts. Please wait a few minutes and try again.", values };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Choose a stronger password" }, values };
    }
    // Don't reveal whether the email exists; DB trigger errors also land here.
    return { formError: "We couldn't create your account. Check your details and try again.", values };
  }

  // Same page whether or not the email was already registered (no account enumeration).
  redirect("/signup/check-email");
}
