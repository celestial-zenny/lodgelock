// Shared by the listing form (client) and the server actions. No server-only imports here.
// The database is the enforcer: keep AMENITIES / CHECKLIST_ITEMS in sync with private.allowed_amenities() and
// private.allowed_checklist_keys() in supabase/migrations/0008_lodge_listing.sql.
import { z } from "zod";
import { AGENT_FEE_CAP_DIVISOR, COMMITMENT_FEE_MAX_PCT, COMMITMENT_FEE_MIN_PCT, LANDLORD_COMMISSION_DEFAULT_PCT,
  LANDLORD_COMMISSION_MAX_PCT } from "@/lib/booking/money";

export const AREAS = ["Eziobodo", "Umuchima", "Ihiagwa"] as const;

export const ROOM_TYPES = [
  { value: "single_room", label: "Single room" },
  { value: "self_contain", label: "Self-contain" },
  { value: "room_and_parlour", label: "Room & parlour" },
  { value: "flat", label: "Flat" },
] as const;
export type RoomType = (typeof ROOM_TYPES)[number]["value"];
export const ROOM_TYPE_LABEL = Object.fromEntries(ROOM_TYPES.map((r) => [r.value, r.label])) as Record<RoomType, string>;

export const AMENITIES = [
  { value: "prepaid_meter", label: "Prepaid meter" },
  { value: "borehole", label: "Borehole water" },
  { value: "fenced", label: "Fenced compound" },
  { value: "security", label: "Security guard" },
  { value: "tiled", label: "Tiled floor" },
  { value: "pop_ceiling", label: "POP ceiling" },
  { value: "own_bathroom", label: "Own bathroom" },
  { value: "shared_bathroom", label: "Shared bathroom" },
  { value: "kitchenette", label: "Kitchenette" },
  { value: "kitchen", label: "Kitchen" },
  { value: "shared_kitchen", label: "Shared kitchen" },
  { value: "wardrobe", label: "Wardrobe" },
  { value: "solar_backup", label: "Solar backup" },
  { value: "parking", label: "Parking" },
] as const;
export type Amenity = (typeof AMENITIES)[number]["value"];
export const AMENITY_LABEL = Object.fromEntries(AMENITIES.map((a) => [a.value, a.label])) as Record<string, string>;

/** Scout inspection checklist. A failed item is shown with ✗; inspection is a bonus badge, never a gate. */
export const CHECKLIST_ITEMS = [
  { value: "matches_listing", label: "Matches the listing" },
  { value: "room_matches_size", label: "Room matches the listed size" },
  { value: "water_running", label: "Running water" },
  { value: "power_working", label: "Steady power supply" },
  { value: "doors_lock", label: "Secure gate and door locks" },
  { value: "no_leaks", label: "No roof leaks" },
  { value: "toilet_working", label: "Toilet and shower work" },
  { value: "generator_away_from_room", label: "Generator placed away from the room" },
] as const;
export const CHECKLIST_LABEL = Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c.value, c.label])) as Record<string, string>;

// ── Photos (bucket `lodge-photos`, limits also set on the bucket)
export const PHOTO_BUCKET = "lodge-photos";
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;

// ── Listing form
/** "250,000" or "250000" naira → integer kobo. */
const naira = (field: string, { min, max }: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/[,\s₦]/g, ""));
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${field} must be a whole number of naira between ${min.toLocaleString("en-NG")} and ${max.toLocaleString("en-NG")}` });
        return z.NEVER;
      }
      return n * 100;
    });

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/**
 * One FormData shape for "List your lodge". Field names are what the form must send.
 * - partnerEmail: a landlord names their agent (optional); an agent must name the landlord.
 * - agentFee: student-paid, only allowed when the lodge has an agent, max 5% of rent.
 * - rentToAgent: landlord only; pays rent to the named agent (signs a payee mandate).
 */
const LodgeFields = z.object({
    title: z.string().trim().min(3, "Give the lodge a title").max(120),
    description: z.string().trim().max(2000).default(""),
    area: z.enum(AREAS, { message: "Choose an area" }),
    address: z.string().trim().min(3, "Enter the address").max(200),
    roomType: z.enum(ROOM_TYPES.map((r) => r.value) as [RoomType, ...RoomType[]], { message: "Choose a room type" }),
    amenities: z.array(z.enum(AMENITIES.map((a) => a.value) as [Amenity, ...Amenity[]])).max(20).default([]),
    distanceToGateM: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(20000)]).default(null),
    nearestGate: z.union([z.literal("").transform(() => null), z.enum(["main_gate", "back_gate"])]).default(null),
    rent: naira("Rent", { min: 10_000, max: 10_000_000 }),
    agentFee: z.union([z.literal("").transform(() => 0), naira("Agent fee", { min: 0, max: 1_000_000 })]).default(0),
    commitmentFeePct: z.coerce.number().int().refine(
      (n) => n === 0 || (n >= COMMITMENT_FEE_MIN_PCT && n <= COMMITMENT_FEE_MAX_PCT),
      `Commitment fee is 0, or ${COMMITMENT_FEE_MIN_PCT}–${COMMITMENT_FEE_MAX_PCT}% of rent`,
    ).default(0),
    landlordCommissionPct: z.coerce.number().int().min(0).max(LANDLORD_COMMISSION_MAX_PCT,
      `Commission can't be more than ${LANDLORD_COMMISSION_MAX_PCT}%`).default(LANDLORD_COMMISSION_DEFAULT_PCT),
    partnerEmail: z.union([z.literal("").transform(() => undefined), z.email("Enter a valid email")]).optional(),
    rentToAgent: checkbox.default(false),
});

function feeWithinCap(v: { agentFee: number; rent: number }, ctx: z.RefinementCtx) {
  if (v.agentFee * AGENT_FEE_CAP_DIVISOR > v.rent) {
    ctx.addIssue({ code: "custom", path: ["agentFee"], message: `Agent fee can't be more than ${100 / AGENT_FEE_CAP_DIVISOR}% of rent` });
  }
}

/** Create form. */
export const LodgeInput = LodgeFields.superRefine((v, ctx) => {
    feeWithinCap(v, ctx);
    if (v.agentFee > 0 && !v.partnerEmail) {
      ctx.addIssue({ code: "custom", path: ["agentFee"], message: "An agent fee needs an agent on the listing" });
    }
    if (v.rentToAgent && !v.partnerEmail) {
      ctx.addIssue({ code: "custom", path: ["rentToAgent"], message: "Name the agent to pay rent to them" });
    }
  });
export type LodgeInput = z.output<typeof LodgeInput>;

/** Edit form: same fields minus the agent/payee (changed elsewhere). The DB still checks agent-fee-needs-agent. */
export const LodgeUpdateInput = LodgeFields.omit({ partnerEmail: true, rentToAgent: true }).superRefine(feeWithinCap);
export type LodgeFieldErrors = Partial<Record<keyof z.input<typeof LodgeInput>, string>>;

/** Read the listing form, including repeated `amenities` checkboxes. */
export function lodgeFormToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = Object.fromEntries(fd);
  obj.amenities = fd.getAll("amenities");
  return obj;
}
