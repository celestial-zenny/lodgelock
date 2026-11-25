import "server-only";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Catalogue lives in the shared module so the listing form can use it too; re-exported for existing pages.
import { AREAS, PHOTO_BUCKET } from "@/lib/listing";
export { AREAS, ROOM_TYPE_LABEL, AMENITY_LABEL, CHECKLIST_LABEL } from "@/lib/listing";

export const GATE_LABEL: Record<string, string> = { main_gate: "main gate", back_gate: "back gate" };

export const MAX_BUDGET_OPTIONS = [
  { value: "20000000", label: "Up to ₦200,000" },
  { value: "30000000", label: "Up to ₦300,000" },
  { value: "50000000", label: "Up to ₦500,000" },
] as const;

export const LodgeFilters = z.object({
  area: z.enum(AREAS).optional().catch(undefined),
  room: z.enum(["single_room", "self_contain", "room_and_parlour", "flat"]).optional().catch(undefined),
  max: z.coerce.number().int().positive().max(1_000_000_000).optional().catch(undefined),
});
export type LodgeFilters = z.infer<typeof LodgeFilters>;

export type Trust = {
  ownerFirstName: string;
  ownerRole: Enums<"user_role">;
  ownerVerified: boolean;
  agentFirstName: string | null;
  agentVerified: boolean | null;
  inspectedAt: string | null;
  checklist: Record<string, boolean> | null;
};

const LIST_COLUMNS =
  "id,title,area,room_type,amenities,distance_to_gate_m,nearest_gate,rent_kobo,agent_fee_kobo,commitment_fee_pct,is_demo" as const;

export type LodgeSummary = Pick<
  Tables<"lodges">,
  | "id" | "title" | "area" | "room_type" | "amenities" | "distance_to_gate_m"
  | "nearest_gate" | "rent_kobo" | "agent_fee_kobo" | "commitment_fee_pct" | "is_demo"
>;

async function trustFor(ids: string[]): Promise<Map<string, Trust>> {
  const map = new Map<string, Trust>();
  if (ids.length === 0) return map;
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("lodge_trust", { p_lodge_ids: ids });
  if (error) throw dbFailure("Loading lodge verification details", error);
  for (const t of data ?? []) {
    map.set(t.lodge_id, {
      ownerFirstName: t.owner_first_name,
      ownerRole: t.owner_role,
      ownerVerified: t.owner_verified,
      agentFirstName: t.agent_first_name ?? null,
      agentVerified: t.agent_verified ?? null,
      inspectedAt: t.inspected_at ?? null,
      checklist: (t.checklist as Record<string, boolean> | null) ?? null,
    });
  }
  return map;
}

export type LodgePhoto = { id: string; url: string };

/** Signed URLs (1 hour) for each lodge's photos, in display order. Storage RLS decides who may see them. */
async function photosFor(supabase: SupabaseClient<Database>, ids: string[]): Promise<Map<string, LodgePhoto[]>> {
  const map = new Map<string, LodgePhoto[]>();
  if (ids.length === 0) return map;
  const { data: rows, error } = await supabase
    .from("lodge_photos")
    .select("id,lodge_id,storage_path,position")
    .in("lodge_id", ids)
    .order("position");
  if (error) throw dbFailure("Loading lodge photos", error);
  if (!rows.length) return map;
  const { data: signed, error: signError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  if (signError) throw dbFailure("Signing lodge photo URLs", { message: signError.message });
  const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  for (const r of rows) {
    const url = urlByPath.get(r.storage_path);
    if (!url) continue;
    map.set(r.lodge_id, [...(map.get(r.lodge_id) ?? []), { id: r.id, url }]);
  }
  return map;
}

export async function listLodges(filters: LodgeFilters) {
  const supabase = await createUserClient();
  let q = supabase
    .from("lodges")
    .select(LIST_COLUMNS)
    .eq("status", "verified")
    .order("rent_kobo", { ascending: true })
    .limit(50);
  if (filters.area) q = q.eq("area", filters.area);
  if (filters.room) q = q.eq("room_type", filters.room);
  if (filters.max) q = q.lte("rent_kobo", filters.max);
  const { data, error } = await q;
  if (error) throw dbFailure("Loading lodges", error);
  const ids = data.map((l) => l.id);
  const [trust, photos] = await Promise.all([trustFor(ids), photosFor(supabase, ids)]);
  return data.map((l) => ({ ...l, trust: trust.get(l.id) ?? null, coverUrl: photos.get(l.id)?.[0]?.url ?? null }));
}

export async function getLodge(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("lodges")
    .select(`${LIST_COLUMNS},description,address,updated_at`)
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error) throw dbFailure("Loading lodge", error);
  if (!data) return null;
  const [trust, photos] = await Promise.all([trustFor([data.id]), photosFor(supabase, [data.id])]);
  return { ...data, trust: trust.get(data.id) ?? null, photos: photos.get(data.id) ?? [] };
}

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80)); // ~4.8 km/h
}
