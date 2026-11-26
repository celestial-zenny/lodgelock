import "server-only";
import { cache } from "react";
import { createUserClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type Viewer =
  | { signedIn: false }
  | { signedIn: true; id: string; role: Enums<"user_role">; firstName: string | null };

/** Who is looking at the page, for navigation only. Pages and actions still do their own auth checks; RLS applies. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { signedIn: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,full_name")
    .eq("id", data.claims.sub)
    .maybeSingle();
  const meta = data.claims.user_metadata as { full_name?: string; role?: Enums<"user_role"> } | undefined;
  const fullName = profile?.full_name ?? meta?.full_name ?? null;
  return {
    signedIn: true,
    id: data.claims.sub,
    role: profile?.role ?? meta?.role ?? "student",
    firstName: fullName?.split(" ")[0] ?? null,
  };
});

/** Landlords, agents and caretakers get the lister navigation; everyone else the student one. */
export function isLister(role: Enums<"user_role">): boolean {
  return role === "landlord" || role === "agent" || role === "caretaker";
}
