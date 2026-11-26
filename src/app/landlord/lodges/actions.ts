"use server";

// Server actions behind "List your lodge" (UI is built by the frontend; see docs/listing-api.md).
// The database enforces every rule (verification, fee caps, amenity list, photo permissions); these actions
// validate input with Zod first so the form can show field errors, then call the RPCs.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";
import { POLICY_VERSION } from "@/lib/auth/signup-schema";
import {
  LodgeInput, LodgeUpdateInput, lodgeFormToObject, MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES,
  type LodgeFieldErrors, type PhotoType,
} from "@/lib/listing";

const Uuid = z.uuid();

/** Turn a database error into something the lister can act on; log the real one. */
function listingMessage(context: string, error: { code?: string; message?: string }): string {
  const m = error.message ?? "";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a while and try again.";
  if (m.includes("verify your identity")) return "Verify your identity before listing a lodge.";
  if (m.includes("only landlords and agents")) return "Only landlord and agent accounts can list lodges.";
  if (m.includes("must name the landlord")) return "Enter the landlord's LodgeLock email.";
  if (m.includes("no landlord account")) return "No landlord account uses that email.";
  if (m.includes("no agent account")) return "No agent account uses that email.";
  if (m.includes("landlord with an agent")) return "Only a landlord with an agent can pay rent to the agent.";
  if (m.includes("agent must be KYC-verified")) return "Your agent must verify their identity before rent can go to them.";
  if (m.includes("agent_fee_cap")) return "The agent fee can't be more than 5% of rent.";
  if (m.includes("agent_fee_needs_agent")) return "An agent fee needs an agent on the listing.";
  if (m.includes("lodges_amenities_known")) return "One of the amenities isn't recognised.";
  if (m.includes("not a draft")) return "This lodge is already waiting for review.";
  if (m.includes("at most 10 photos")) return "A lodge can have at most 10 photos.";
  if (m.includes("not been uploaded")) return "That photo didn't finish uploading. Try again.";
  dbFailure(context, error);
  return "Something went wrong. Please try again.";
}

async function signedInClient(next: string) {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=${encodeURIComponent(next)}`);
  return supabase;
}

export type LodgeFormState = {
  error?: string;
  fieldErrors?: LodgeFieldErrors;
  /** Echoed text fields so the form keeps them after a failed submit. */
  values?: Record<string, string>;
  /** Set on success: upload photos for this lodge next. */
  lodgeId?: string;
} | null;

function parseLodgeForm<S extends typeof LodgeInput | typeof LodgeUpdateInput>(formData: FormData, schema: S) {
  const raw = lodgeFormToObject(formData);
  const values = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { values, data: parsed.data as z.output<S> } as const;
  const fe = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors = Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as LodgeFieldErrors;
  return { values, fieldErrors } as const;
}

/** Create a listing. It goes straight to admin review; returns `lodgeId` for the photo step. */
export async function createLodge(_prev: LodgeFormState, formData: FormData): Promise<LodgeFormState> {
  const form = parseLodgeForm(formData, LodgeInput);
  if (!("data" in form) || !form.data) return { fieldErrors: form.fieldErrors, values: form.values };
  const v = form.data;

  const supabase = await signedInClient("/landlord");
  const { data: lodgeId, error } = await supabase.rpc("create_lodge", {
    p_title: v.title,
    p_description: v.description,
    p_area: v.area,
    p_address: v.address,
    p_room_type: v.roomType,
    p_amenities: v.amenities,
    p_distance_to_gate_m: v.distanceToGateM,
    p_nearest_gate: v.nearestGate,
    p_rent_kobo: v.rent,
    p_agent_fee_kobo: v.agentFee,
    p_commitment_fee_pct: v.commitmentFeePct,
    p_landlord_commission_pct: v.landlordCommissionPct,
    p_partner_email: v.partnerEmail ?? null,
    p_rent_to_agent: v.rentToAgent,
    p_policy_version: POLICY_VERSION,
  });
  if (error || !lodgeId) return { error: listingMessage("Creating a lodge", error ?? {}), values: form.values };

  revalidatePath("/landlord");
  return { lodgeId };
}

/**
 * Edit an existing listing's details (not its agent or payee). Bind the id: `updateLodge.bind(null, lodgeId)`.
 * Editing a live lodge sends it back to review (enforced by the database).
 */
export async function updateLodge(lodgeId: string, _prev: LodgeFormState, formData: FormData): Promise<LodgeFormState> {
  if (!Uuid.safeParse(lodgeId).success) return { error: "Invalid lodge." };
  const form = parseLodgeForm(formData, LodgeUpdateInput);
  if (!("data" in form) || !form.data) return { fieldErrors: form.fieldErrors, values: form.values };
  const v = form.data;

  const supabase = await signedInClient(`/landlord`);
  // RLS (lodges_edit) limits this to the lodge's owner/agent; lodges_guard handles status and ownership.
  const { data, error } = await supabase
    .from("lodges")
    .update({
      title: v.title,
      description: v.description,
      area: v.area,
      address: v.address,
      room_type: v.roomType,
      amenities: v.amenities,
      distance_to_gate_m: v.distanceToGateM,
      nearest_gate: v.nearestGate,
      rent_kobo: v.rent,
      agent_fee_kobo: v.agentFee,
      commitment_fee_pct: v.commitmentFeePct,
      landlord_commission_pct: v.landlordCommissionPct,
    })
    .eq("id", lodgeId)
    .select("id");
  if (error) return { error: listingMessage("Updating a lodge", error), values: form.values };
  if (!data?.length) return { error: "Lodge not found.", values: form.values };

  revalidatePath("/landlord");
  revalidatePath(`/lodges/${lodgeId}`);
  return { lodgeId };
}

/** Send a draft (new or rejected) back to admin review. */
export async function submitLodge(lodgeId: string): Promise<{ error?: string }> {
  if (!Uuid.safeParse(lodgeId).success) return { error: "Invalid lodge." };
  const supabase = await signedInClient("/landlord");
  const { error } = await supabase.rpc("submit_lodge", { p_lodge: lodgeId });
  if (error) return { error: listingMessage("Submitting a lodge", error) };
  revalidatePath("/landlord");
  return {};
}

// ── Photos: the browser uploads bytes straight to Supabase Storage with a one-time signed URL that only
// this server action can issue, then confirms. Use uploadLodgePhoto() from "@/lib/listing-upload".

const PhotoRequest = z.object({
  lodgeId: z.uuid(),
  type: z.enum(Object.keys(PHOTO_TYPES) as [PhotoType, ...PhotoType[]], { message: "Use a JPG, PNG or WebP photo" }),
  size: z.number().int().positive().max(MAX_PHOTO_BYTES, "Photos must be 5 MB or smaller"),
});

export async function requestPhotoUpload(
  input: z.input<typeof PhotoRequest>,
): Promise<{ error: string } | { path: string; token: string }> {
  const parsed = PhotoRequest.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  const { lodgeId, type } = parsed.data;

  const supabase = await signedInClient("/landlord");
  // The server picks the name; storage RLS checks the caller may add photos to this lodge.
  const path = `${lodgeId}/${crypto.randomUUID()}.${PHOTO_TYPES[type]}`;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    dbFailure("Creating a photo upload URL", { message: error?.message });
    return { error: "You can't add photos to this lodge right now." };
  }
  return { path: data.path, token: data.token };
}

export async function confirmPhotoUpload(lodgeId: string, path: string): Promise<{ error: string } | { photoId: string }> {
  if (!Uuid.safeParse(lodgeId).success || !path.startsWith(`${lodgeId}/`)) return { error: "Invalid photo." };
  const supabase = await signedInClient("/landlord");
  const { data: photoId, error } = await supabase.rpc("add_lodge_photo", { p_lodge: lodgeId, p_path: path });
  if (error || !photoId) {
    // Don't leave an orphaned file behind (e.g. the 11th photo).
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: listingMessage("Saving a lodge photo", error ?? {}) };
  }
  revalidatePath("/landlord");
  revalidatePath(`/lodges/${lodgeId}`);
  return { photoId };
}

export async function removeLodgePhoto(photoId: string): Promise<{ error?: string }> {
  if (!Uuid.safeParse(photoId).success) return { error: "Invalid photo." };
  const supabase = await signedInClient("/landlord");
  const { data: path, error } = await supabase.rpc("remove_lodge_photo", { p_photo: photoId });
  if (error || !path) return { error: listingMessage("Removing a lodge photo", error ?? {}) };
  const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (storageError) dbFailure("Deleting a lodge photo file", { message: storageError.message });
  revalidatePath("/landlord");
  return {};
}
