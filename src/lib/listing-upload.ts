// Client helper for the listing form: upload one photo for a lodge.
//   const res = await uploadLodgePhoto(lodgeId, file);
//   if ("error" in res) showError(res.error); else addThumbnail(res.photoId);
// The bytes go straight from the phone to Supabase Storage (no server body limits); the server issues the
// one-time upload URL, picks the file name, and records the photo after checking the upload really landed.
import { createBrowserSupabase } from "@/lib/supabase/client";
import { confirmPhotoUpload, requestPhotoUpload } from "@/app/landlord/lodges/actions";
import { MAX_PHOTO_BYTES, PHOTO_BUCKET, PHOTO_TYPES } from "@/lib/listing";

export async function uploadLodgePhoto(lodgeId: string, file: File): Promise<{ error: string } | { photoId: string }> {
  if (!(file.type in PHOTO_TYPES)) return { error: "Use a JPG, PNG or WebP photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photos must be 5 MB or smaller." };

  const ticket = await requestPhotoUpload({ lodgeId, type: file.type as keyof typeof PHOTO_TYPES, size: file.size });
  if ("error" in ticket) return ticket;

  const { error } = await createBrowserSupabase()
    .storage.from(PHOTO_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) return { error: "Upload failed. Check your connection and try again." };

  return confirmPhotoUpload(lodgeId, ticket.path);
}
