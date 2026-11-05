"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { POLICY_VERSION } from "@/lib/auth/signup-schema";

export type FormState = { error?: string; ok?: string } | null;

async function signedIn() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/landlord");
  return supabase;
}

const CaretakerInput = z.object({
  lodgeId: z.uuid(),
  email: z.union([z.literal(""), z.email("Enter the caretaker's email").max(254)]),
});

/** Assign (or clear, with an empty email) the lodge's caretaker. They must already have a caretaker account. */
export async function setCaretaker(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = CaretakerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const supabase = await signedIn();
  const { error } = await supabase.rpc("set_lodge_caretaker", {
    p_lodge: parsed.data.lodgeId,
    p_email: parsed.data.email || null,
  });
  if (error) {
    if (error.message.includes("rate limit")) return { error: "Too many attempts. Try again in an hour." };
    if (error.message.includes("no caretaker account")) {
      return { error: "No caretaker account uses that email. Ask them to sign up as a caretaker first." };
    }
    return { error: "We couldn't update the caretaker." };
  }
  revalidatePath("/landlord");
  return { ok: parsed.data.email ? "Caretaker assigned." : "Caretaker removed." };
}

const MandateInput = z.object({
  lodgeId: z.uuid(),
  agentId: z.uuid(),
  agree: z.literal("on", { message: "Tick the box to sign the mandate" }),
});

/** Landlord signs an in-app payee mandate: rent for this lodge goes to the named, KYC-verified agent. */
export async function signMandate(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = MandateInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const supabase = await signedIn();
  const { error } = await supabase.rpc("sign_payee_mandate", {
    p_lodge: parsed.data.lodgeId,
    p_agent: parsed.data.agentId,
    p_policy_version: POLICY_VERSION,
  });
  if (error) {
    if (error.message.includes("landlord must be verified")) return { error: "Verify your identity first." };
    if (error.message.includes("KYC-verified")) return { error: "The agent must finish identity verification first." };
    return { error: "We couldn't save the mandate." };
  }
  revalidatePath("/landlord");
  return { ok: "Mandate signed." };
}

export async function revokeMandate(_prev: FormState, formData: FormData): Promise<FormState> {
  const lodgeId = z.uuid().safeParse(formData.get("lodgeId"));
  if (!lodgeId.success) return { error: "Invalid lodge." };
  const supabase = await signedIn();
  const { error } = await supabase.rpc("revoke_payee_mandate", { p_lodge: lodgeId.data });
  if (error) return { error: "No active mandate to revoke." };
  revalidatePath("/landlord");
  return { ok: "Mandate revoked. Rent goes to you again." };
}
