"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";

const Decision = z.object({
  lodgeId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export type LodgeDecisionState = { error?: string } | null;

/** review_lodge enforces admin-only, verified landlord/agent on approve, and a reason on reject. */
export async function decideLodge(_prev: LodgeDecisionState, formData: FormData): Promise<LodgeDecisionState> {
  const parsed = Decision.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createUserClient();
  const { error } = await supabase.rpc("review_lodge", {
    p_lodge: parsed.data.lodgeId,
    p_approve: parsed.data.decision === "approve",
    p_note: parsed.data.note || null,
  });
  if (error) {
    if (error.message.includes("admins only")) return { error: "Admins only." };
    if (error.message.includes("give a reason")) return { error: "Add a reason so the lister knows what to fix." };
    if (error.message.includes("landlord is not verified")) return { error: "Can't approve: the landlord isn't verified yet." };
    if (error.message.includes("agent is not verified")) return { error: "Can't approve: the agent isn't verified yet." };
    if (error.message.includes("not waiting for review")) return { error: "Someone already decided this one." };
    dbFailure("Reviewing a lodge", error);
    return { error: "Couldn't save the decision." };
  }
  revalidatePath("/admin/lodges");
  revalidatePath("/lodges");
  return null;
}
