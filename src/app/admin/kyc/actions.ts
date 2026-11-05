"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";

const Decision = z.object({
  reviewId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export type DecisionState = { error?: string } | null;

/** decide_kyc_review enforces admin-only and "approve only if all checks passed" in the DB. */
export async function decideKyc(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const parsed = Decision.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createUserClient();
  const { error } = await supabase.rpc("decide_kyc_review", {
    p_review: parsed.data.reviewId,
    p_approve: parsed.data.decision === "approve",
    p_note: parsed.data.note || undefined,
  });
  if (error) {
    if (error.message.includes("admins only")) return { error: "Admins only." };
    if (error.message.includes("not all checks passed")) return { error: "Can't approve: not every check passed." };
    if (error.message.includes("already decided")) return { error: "Someone already decided this one." };
    return { error: "Couldn't save the decision." };
  }
  revalidatePath("/admin/kyc");
  return null;
}
