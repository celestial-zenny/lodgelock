"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";

export type DeletionState = { error?: string; done?: boolean } | null;

const DeletionInput = z.object({
  reason: z.string().trim().max(1000, "Keep it under 1,000 characters").optional(),
  confirm: z.literal("on", { message: "Tick the box to confirm" }),
});

export async function requestDeletion(_prev: DeletionState, formData: FormData): Promise<DeletionState> {
  const parsed = DeletionInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Please log in again." };

  const { error } = await supabase.from("data_deletion_requests").insert({
    user_id: auth.claims.sub,
    reason: parsed.data.reason || null,
  });
  if (error) {
    // 23505 = unique violation on the one-pending-request index
    if (error.code === "23505") return { error: "You already have a pending request. We'll be in touch." };
    return { error: "We couldn't submit your request. Please try again." };
  }
  revalidatePath("/account");
  return { done: true };
}
