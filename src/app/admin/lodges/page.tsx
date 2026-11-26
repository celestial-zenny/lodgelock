import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";
import { formatNaira } from "@/lib/booking/money";
import { AMENITY_LABEL, PHOTO_BUCKET, ROOM_TYPE_LABEL } from "@/lib/listing";
import { LodgeDecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Lodge approvals — LodgeLock admin" };

const dt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
});

export default function AdminLodgesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lodge approvals</h1>
      <p className="text-sm text-muted">Approving makes a lodge live. A scout inspection is a separate badge, not required.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/admin/lodges");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.claims.sub).maybeSingle();
  if (me?.role !== "admin") notFound();

  // RLS: admins can read every lodge and profile.
  const { data: lodges, error } = await supabase
    .from("lodges")
    .select(`id,title,area,address,room_type,amenities,rent_kobo,agent_fee_kobo,commitment_fee_pct,
             landlord_commission_pct,description,submitted_at,
             owner:profiles!lodges_owner_id_fkey(full_name,identity_verified_at),
             agent:profiles!lodges_agent_id_fkey(full_name,identity_verified_at),
             lodge_photos(storage_path,position)`)
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });
  if (error) dbFailure("Loading the lodge approval queue", error);
  if (error) return <p role="alert" className="text-danger">Couldn&apos;t load the queue.</p>;
  if (!lodges?.length) return <p className="text-muted">Nothing waiting for review.</p>;

  const paths = lodges.flatMap((l) => l.lodge_photos.map((p) => p.storage_path));
  const { data: signed } = paths.length
    ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  return (
    <ul className="space-y-4">
      {lodges.map((l) => {
        const photos = [...l.lodge_photos].sort((a, b) => a.position - b.position);
        return (
          <li key={l.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{l.title}</p>
              {l.submitted_at && <p className="text-xs text-muted">{dt.format(new Date(l.submitted_at))}</p>}
            </div>
            <p className="text-sm text-muted">
              {ROOM_TYPE_LABEL[l.room_type]} · {l.address}, {l.area}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Rent</dt><dd>{formatNaira(l.rent_kobo)}</dd>
              <dt className="text-muted">Agent fee</dt><dd>{l.agent_fee_kobo ? formatNaira(l.agent_fee_kobo) : "None"}</dd>
              <dt className="text-muted">Commitment fee</dt><dd>{l.commitment_fee_pct ? `${l.commitment_fee_pct}%` : "None"}</dd>
              <dt className="text-muted">Landlord commission</dt><dd>{l.agent ? `${l.landlord_commission_pct}%` : "—"}</dd>
              <dt className="text-muted">Landlord</dt>
              <dd>{l.owner?.full_name} {l.owner?.identity_verified_at ? "· verified" : "· NOT verified"}</dd>
              {l.agent && (<><dt className="text-muted">Agent</dt>
                <dd>{l.agent.full_name} {l.agent.identity_verified_at ? "· verified" : "· NOT verified"}</dd></>)}
            </dl>
            {l.amenities.length > 0 && (
              <p className="text-sm text-muted">{l.amenities.map((a) => AMENITY_LABEL[a] ?? a).join(" · ")}</p>
            )}
            {l.description && <p className="text-sm">{l.description}</p>}
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => {
                  const url = urlByPath.get(p.storage_path);
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs, admin-only view
                  return url ? <img key={p.storage_path} src={url} alt="" className="aspect-square w-full rounded-lg object-cover" /> : null;
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">No photos yet.</p>
            )}
            <LodgeDecisionForm lodgeId={l.id} />
          </li>
        );
      })}
    </ul>
  );
}
