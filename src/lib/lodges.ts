import "server-only";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export const AREAS = ["Eziobodo", "Umuchima", "Ihiagwa"] as const;

export const ROOM_TYPE_LABEL: Record<Enums<"room_type">, string> = {
  single_room: "Single room",
  self_contain: "Self-contain",
  room_and_parlour: "Room & parlour",
  flat: "Flat",
};

export const AMENITY_LABEL: Record<string, string> = {
  prepaid_meter: "Prepaid meter",
  borehole: "Borehole water",
  fenced: "Fenced compound",
  security: "Security guard",
  tiled: "Tiled floors",
  pop_ceiling: "POP ceiling",
  kitchenette: "Kitchenette",
  kitchen: "Kitchen",
  shared_kitchen: "Shared kitchen",
  shared_bathroom: "Shared bathroom",
  wardrobe: "Wardrobe",
  solar_backup: "Solar backup",
  parking: "Parking",
};

export const CHECKLIST_LABEL: Record<string, string> = {
  matches_listing: "Matches the listing",
  water_running: "Water running",
  power_working: "Power working",
  doors_lock: "Doors and windows lock",
  no_leaks: "No roof leaks",
  toilet_working: "Toilet and shower work",
};

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
  const trust = await trustFor(data.map((l) => l.id));
  return data.map((l) => ({ ...l, trust: trust.get(l.id) ?? null }));
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
  const trust = await trustFor([data.id]);
  return { ...data, trust: trust.get(data.id) ?? null };
}

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80)); // ~4.8 km/h
}
