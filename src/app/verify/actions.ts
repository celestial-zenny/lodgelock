"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { POLICY_VERSION } from "@/lib/auth/signup-schema";
import { marketplace, MarketplaceError } from "@/lib/interswitch/marketplace";
import { KycDetails, splitName } from "@/lib/kyc/schema";
import { runKycChecks } from "@/lib/kyc/run";
import { activeKycConsents } from "./state";

export type ConsentState = { error?: string } | null;

const ConsentInput = z.object({ agree: z.literal("on", { message: "Tick the box to give consent" }) });

function rpcMessage(message: string | undefined): string {
  if (message?.includes("rate limit")) return "Too many attempts today. Please try again tomorrow.";
  if (message?.includes("only landlords")) return "Identity checks are for landlord and agent accounts.";
  if (message?.includes("already verified")) return "Your identity is already verified.";
  if (message?.includes("review already pending")) return "Your checks are already with our team for review.";
  if (message?.includes("18 or over")) return "You must be 18 or over to list lodges.";
  return "Something went wrong. Please try again.";
}

/** Step 1: record explicit, purpose-specific consent BEFORE any identifier is collected or sent. */
export async function grantKycConsent(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const parsed = ConsentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/verify");

  const { error } = await supabase.rpc("kyc_grant_consent", { p_policy_version: POLICY_VERSION });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath("/verify");
  return null;
}

/** Withdraw the unused consent set (user changed their mind on the details screen). */
export async function withdrawKycConsent(): Promise<void> {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/verify");
  const consents = await activeKycConsents(supabase, auth.claims.sub);
  if (consents) {
    await supabase
      .from("consents")
      .update({ withdrawn_at: new Date().toISOString() })
      .in("id", [consents.nin, consents.bvn, consents.bank]);
  }
  revalidatePath("/verify");
}

export type KycState = {
  error?: string;
  fieldErrors?: Partial<Record<"nin" | "bvn" | "accountNumber" | "bankCode", string>>;
} | null;

/** Step 2: run NIN -> BVN Boolean Match -> bank account, store pass/fail only, queue for admin review. */
export async function submitKyc(_prev: KycState, formData: FormData): Promise<KycState> {
  const parsed = KycDetails.safeParse({
    nin: formData.get("nin"),
    bvn: formData.get("bvn"),
    accountNumber: formData.get("accountNumber"),
    bankCode: formData.get("bankCode"),
  });
  if (!parsed.success) {
    const fieldErrors: NonNullable<KycState>["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] as keyof typeof fieldErrors;
      fieldErrors[k] ??= i.message;
    }
    return { fieldErrors };
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/verify");
  const uid = auth.claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,role,identity_verified_at,is_adult")
    .eq("id", uid)
    .maybeSingle();
  if (!profile || !["landlord", "agent"].includes(profile.role)) {
    return { error: "Identity checks are for landlord and agent accounts." };
  }
  if (profile.identity_verified_at) return { error: "Your identity is already verified." };
  const name = splitName(profile.full_name);
  if (!name) return { error: "Add your first and last name to your profile, exactly as on your NIN, then try again." };

  // Consent must already be on record. No consent, no provider call.
  const consents = await activeKycConsents(supabase, uid);
  if (!consents) return { error: "Your consent has expired. Please review and give consent again." };

  const { error: rlError } = await supabase.rpc("kyc_begin_check");
  if (rlError) return { error: rpcMessage(rlError.message) };

  let results;
  try {
    results = await runKycChecks(marketplace(), name, parsed.data);
  } catch (e) {
    // MarketplaceError messages carry only a code + HTTP status: safe to log.
    console.error("kyc checks failed", { code: e instanceof MarketplaceError ? e.code : "unexpected", status: e instanceof MarketplaceError ? e.status : undefined });
    return { error: "We couldn't reach the verification service. Nothing was recorded. Please try again shortly." };
  }

  let db;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error((e as Error).message);
    return { error: "Verification isn't configured yet." };
  }
  const { error } = await db.rpc("record_kyc_submission", {
    p_subject: uid,
    p_nin_passed: results.nin,
    // null = check skipped because an earlier one failed (the RPC accepts null; generated types don't say so)
    p_bvn_passed: results.bvn as boolean,
    p_bank_passed: results.bank as boolean,
    p_nin_consent: consents.nin,
    p_bvn_consent: consents.bvn,
    p_bank_consent: consents.bank,
  });
  if (error) {
    console.error("record_kyc_submission failed", { code: error.code });
    if (error.code === "23505") return { error: "Your checks are already with our team for review." };
    return { error: "We couldn't save your result. Please try again." };
  }
  revalidatePath("/verify");
  revalidatePath("/admin/kyc");
  redirect("/verify");
}
