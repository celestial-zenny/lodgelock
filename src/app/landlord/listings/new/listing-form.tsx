"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createLodge, type LodgeFormState } from "@/app/landlord/lodges/actions";
import { uploadLodgePhoto } from "@/lib/listing-upload";
import {
  AMENITIES, AREAS, MAX_PHOTOS, ROOM_TYPES,
} from "@/lib/listing";
import {
  AGENT_FEE_CAP_PCT, COMMITMENT_FEE_MAX_PCT, COMMITMENT_FEE_MIN_PCT, LANDLORD_COMMISSION_DEFAULT_PCT,
  LANDLORD_COMMISSION_MAX_PCT, formatNaira, maxAgentFeeKobo,
} from "@/lib/booking/money";
import { Field, inputClass } from "@/components/field";
import { useToast } from "@/components/toast";
import { Icon } from "@/components/icons";
import { btn, card, sectionTitle } from "@/components/ui";

const COMMITMENT_OPTIONS = [0, ...Array.from({ length: COMMITMENT_FEE_MAX_PCT - COMMITMENT_FEE_MIN_PCT + 1 }, (_, i) => COMMITMENT_FEE_MIN_PCT + i)];

export function ListingForm({ role }: { role: "landlord" | "agent" }) {
  const [state, action, pending] = useActionState<LodgeFormState, FormData>(createLodge, null);
  if (state?.lodgeId) return <PhotoStep lodgeId={state.lodgeId} />;
  return <DetailsForm role={role} state={state} action={action} pending={pending} />;
}

function DetailsForm({ role, state, action, pending }: {
  role: "landlord" | "agent";
  state: LodgeFormState;
  action: (fd: FormData) => void;
  pending: boolean;
}) {
  const fe = state?.fieldErrors ?? {};
  const val = state?.values ?? {};
  const [rent, setRent] = useState(val.rent ?? "");
  const [partner, setPartner] = useState(val.partnerEmail ?? "");
  const rentNaira = Number(rent.replace(/[,\s₦]/g, ""));
  const maxFee = Number.isInteger(rentNaira) && rentNaira > 0 ? maxAgentFeeKobo(rentNaira * 100) : null;
  const hasAgent = role === "agent" || partner.trim().length > 0;
  const err = (k: keyof typeof fe) => (fe[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form action={action} className="space-y-8" noValidate>
      {state?.error && <p role="alert" className="rounded-xl bg-signal-soft px-4 py-3 text-sm font-medium text-signal">{state.error}</p>}

      <fieldset className="space-y-5">
        <legend className={sectionTitle}>The lodge</legend>
        <Field label="Title" htmlFor="title" error={fe.title} hint="What students know it as, e.g. Divine Grace Lodge">
          <input id="title" name="title" required maxLength={120} defaultValue={val.title} className={inputClass} {...err("title")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Area" htmlFor="area" error={fe.area}>
            <select id="area" name="area" defaultValue={val.area ?? ""} required className={inputClass} {...err("area")}>
              <option value="" disabled>Choose an area</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Room type" htmlFor="roomType" error={fe.roomType}>
            <select id="roomType" name="roomType" defaultValue={val.roomType ?? ""} required className={inputClass} {...err("roomType")}>
              <option value="" disabled>Choose a room type</option>
              {ROOM_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Address" htmlFor="address" error={fe.address}>
          <input id="address" name="address" required maxLength={200} autoComplete="street-address" defaultValue={val.address} className={inputClass} {...err("address")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Walking distance to FUTO gate (metres, optional)" htmlFor="distanceToGateM" error={fe.distanceToGateM}>
            <input id="distanceToGateM" name="distanceToGateM" inputMode="numeric" defaultValue={val.distanceToGateM} className={inputClass} {...err("distanceToGateM")} />
          </Field>
          <Field label="Nearest gate (optional)" htmlFor="nearestGate" error={fe.nearestGate}>
            <select id="nearestGate" name="nearestGate" defaultValue={val.nearestGate ?? ""} className={inputClass} {...err("nearestGate")}>
              <option value="">Not sure</option>
              <option value="main_gate">Main gate</option>
              <option value="back_gate">Back gate</option>
            </select>
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">Amenities</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <label key={a.value} className="cursor-pointer">
                <input type="checkbox" name="amenities" value={a.value} className="peer sr-only" />
                <span className="inline-flex min-h-10 items-center rounded-full border border-line-strong/60 bg-surface px-3.5 text-sm font-medium peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-ink peer-focus-visible:outline-3 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                  {a.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Description (optional)" htmlFor="description" error={fe.description}>
          <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={val.description} className={inputClass} {...err("description")} />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className={sectionTitle}>{role === "agent" ? "Landlord" : "Agent (optional)"}</legend>
        <Field label={role === "agent" ? "Landlord's LodgeLock email" : "Your agent's LodgeLock email"} htmlFor="partnerEmail"
          error={fe.partnerEmail}
          hint={role === "agent" ? "The landlord must already have a LodgeLock account." : "Leave empty if you're listing without an agent."}>
          <input id="partnerEmail" name="partnerEmail" type="email" inputMode="email" autoComplete="off" required={role === "agent"}
            value={partner} onChange={(e) => setPartner(e.target.value)} className={inputClass} {...err("partnerEmail")} />
        </Field>
        {role === "landlord" && partner.trim() && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="rentToAgent" defaultChecked={val.rentToAgent === "on"} className="mt-0.5 size-5 accent-[var(--brand)]" />
            <span>Pay rent to my agent instead of me. This signs a payee mandate you can revoke later. The agent must be ID-verified.</span>
          </label>
        )}
        {fe.rentToAgent && <p className="text-sm text-signal">{fe.rentToAgent}</p>}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className={sectionTitle}>Money</legend>
        <Field label="Rent for one year (₦)" htmlFor="rent" error={fe.rent} hint="Whole naira, e.g. 250,000">
          <input id="rent" name="rent" inputMode="numeric" required value={rent} onChange={(e) => setRent(e.target.value)}
            className={inputClass} {...err("rent")} />
        </Field>
        {hasAgent && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Agent fee paid by the student (₦)" htmlFor="agentFee" error={fe.agentFee}
              hint={maxFee !== null ? `Up to ${AGENT_FEE_CAP_PCT}% of rent: at most ${formatNaira(maxFee)}` : `Up to ${AGENT_FEE_CAP_PCT}% of rent`}>
              <input id="agentFee" name="agentFee" inputMode="numeric" defaultValue={val.agentFee} className={inputClass} {...err("agentFee")} />
            </Field>
            <Field label="Commission from the landlord's rent (%)" htmlFor="landlordCommissionPct" error={fe.landlordCommissionPct}
              hint={`0 to ${LANDLORD_COMMISSION_MAX_PCT}%. Comes out of the landlord's rent, never the student's payment.`}>
              <input id="landlordCommissionPct" name="landlordCommissionPct" type="number" min={0} max={LANDLORD_COMMISSION_MAX_PCT}
                defaultValue={val.landlordCommissionPct ?? LANDLORD_COMMISSION_DEFAULT_PCT} className={inputClass} {...err("landlordCommissionPct")} />
            </Field>
          </div>
        )}
        <Field label="Commitment fee" htmlFor="commitmentFeePct" error={fe.commitmentFeePct}
          hint="Optional. Paid to the landlord when the student pays, and not held. Students see it before they pay.">
          <select id="commitmentFeePct" name="commitmentFeePct" defaultValue={val.commitmentFeePct ?? "0"} className={inputClass} {...err("commitmentFeePct")}>
            {COMMITMENT_OPTIONS.map((p) => <option key={p} value={p}>{p === 0 ? "None" : `${p}% of rent`}</option>)}
          </select>
        </Field>
      </fieldset>

      <div className={`${card} space-y-3 p-4 text-sm text-muted`}>
        <p className="flex gap-2.5"><Icon name="info" className="shrink-0 text-brand" />
          An admin approves your lodge and it goes live. A scout visit later adds an inspected badge.</p>
        <button disabled={pending} className={`${btn.primary} w-full`}>{pending ? "Sending…" : "Send for review"}</button>
      </div>
    </form>
  );
}

function PhotoStep({ lodgeId }: { lodgeId: string }) {
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      const res = await uploadLodgePhoto(lodgeId, file);
      if ("error" in res) { setError(res.error); break; }
      setPhotos((p) => [...p, { name: file.name, url: URL.createObjectURL(file) }]);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl bg-leaf-soft p-4 text-sm font-medium text-leaf">
        <Icon name="check" className="shrink-0" />
        <p>Sent for review. Add photos now: students book with more confidence when they can see the room.</p>
      </div>
      <section aria-labelledby="ph" className={`${card} space-y-4 p-5`}>
        <h2 id="ph" className={sectionTitle}>Photos</h2>
        <label className={`${btn.secondary} w-full cursor-pointer ${busy || photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-60" : ""}`}>
          <Icon name="camera" />{busy ? "Uploading…" : "Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
            disabled={busy || photos.length >= MAX_PHOTOS} onChange={(e) => onFiles(e.target.files)} />
        </label>
        <p className="text-xs text-muted">Up to {MAX_PHOTOS} photos, JPG, PNG or WebP, 5 MB each.</p>
        {error && <p role="alert" className="text-sm text-signal">{error}</p>}
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded file
              <li key={p.url}><img src={p.url} alt={p.name} className="aspect-square w-full rounded-xl object-cover" /></li>
            ))}
          </ul>
        )}
      </section>
      <Link href="/landlord/listings" className={`${btn.primary} w-full`}
        onClick={() => toast(photos.length ? `Lodge sent for review with ${photos.length} photo${photos.length === 1 ? "" : "s"}.` : "Lodge sent for review.")}>
        Done
      </Link>
    </div>
  );
}
