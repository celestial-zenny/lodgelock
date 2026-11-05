import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { CONSENT_WINDOW_MS } from "@/lib/kyc/schema";

type Db = Awaited<ReturnType<typeof createUserClient>>;

export type ActiveConsents = { nin: string; bvn: string; bank: string };

/**
 * The consent set granted on the consent screen and not yet used: all three purposes, not withdrawn,
 * granted within the window and after the user's last KYC submission. RLS limits rows to the caller.
 */
export async function activeKycConsents(db: Db, userId: string): Promise<ActiveConsents | null> {
  const { data: last } = await db
    .from("kyc_reviews")
    .select("submitted_at")
    .eq("subject_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const windowStart = Date.now() - CONSENT_WINDOW_MS;
  const since = new Date(Math.max(windowStart, last ? new Date(last.submitted_at).getTime() : 0)).toISOString();

  const { data } = await db
    .from("consents")
    .select("id,purpose,granted_at")
    .eq("user_id", userId)
    .in("purpose", ["kyc_nin", "kyc_bvn", "kyc_bank"])
    .is("withdrawn_at", null)
    .gt("granted_at", since)
    .order("granted_at", { ascending: false });

  const pick = (p: string) => data?.find((c) => c.purpose === p)?.id;
  const nin = pick("kyc_nin");
  const bvn = pick("kyc_bvn");
  const bank = pick("kyc_bank");
  return nin && bvn && bank ? { nin, bvn, bank } : null;
}
