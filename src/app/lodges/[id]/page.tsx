import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AMENITY_LABEL, CHECKLIST_LABEL, GATE_LABEL, ROOM_TYPE_LABEL, getLodge, walkingMinutes } from "@/lib/lodges";
import { AGENT_FEE_CAP_DIVISOR, formatNaira } from "@/lib/booking/money";
import { MOVE_IN_WINDOW_HOURS } from "@/lib/booking/state-machine";
import { createUserClient } from "@/lib/supabase/server";
import { Badge, TrustBadges } from "@/components/lodge-badges";
import { LodgeVisual } from "@/components/lodge-visual";
import { BookButton } from "./book-button";

export async function generateMetadata({ params }: PageProps<"/lodges/[id]">): Promise<Metadata> {
  const lodge = await getLodge((await params).id);
  return { title: lodge ? `${lodge.title}, ${lodge.area} — LodgeLock` : "Lodge not found — LodgeLock" };
}

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function LodgePage({ params }: PageProps<"/lodges/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LodgeDetail params={params} />
    </Suspense>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1" aria-busy="true">
      <div className="h-48 animate-pulse bg-line sm:h-64" />
      <div className="space-y-3 px-4 pt-4">
        <div className="h-7 w-2/3 animate-pulse rounded bg-line" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
        <div className="h-32 animate-pulse rounded-xl bg-line" />
      </div>
    </main>
  );
}

async function LodgeDetail({ params }: { params: PageProps<"/lodges/[id]">["params"] }) {
  const { id } = await params;
  const lodge = await getLodge(id);
  if (!lodge) notFound();

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  const signedIn = Boolean(auth?.claims);
  const t = lodge.trust;
  const total = lodge.rent_kobo + lodge.agent_fee_kobo;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 pb-28">
      <LodgeVisual area={lodge.area} roomType={lodge.room_type} className="h-48 sm:h-64 sm:rounded-b-2xl" />

      <div className="space-y-6 px-4 pt-4">
        <div>
          <Link href="/lodges" className="text-sm text-muted underline">← All lodges</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lodge.title}</h1>
          <p className="text-muted">
            {ROOM_TYPE_LABEL[lodge.room_type]} · {lodge.address}
          </p>
          {lodge.distance_to_gate_m != null && lodge.nearest_gate && (
            <p className="text-sm text-muted">
              About {walkingMinutes(lodge.distance_to_gate_m)} min walk ({(lodge.distance_to_gate_m / 1000).toFixed(1)} km) to the FUTO {GATE_LABEL[lodge.nearest_gate]}
            </p>
          )}
          <div className="mt-3"><TrustBadges trust={t} isDemo={lodge.is_demo} /></div>
          {lodge.is_demo && (
            <p className="mt-2 text-xs text-warn">Sample listing for the LodgeLock prototype. It isn&apos;t a real lodge.</p>
          )}
        </div>

        <section aria-labelledby="price" className="rounded-xl border border-line bg-surface p-4">
          <h2 id="price" className="font-semibold">What you pay</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Rent (1 year)</dt><dd>{formatNaira(lodge.rent_kobo)}</dd></div>
            <div className="flex justify-between">
              <dt>Agent fee <span className="text-muted">(capped at {100 / AGENT_FEE_CAP_DIVISOR}%)</span></dt>
              <dd>{lodge.agent_fee_kobo > 0 ? formatNaira(lodge.agent_fee_kobo) : "None"}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt><dd>{formatNaira(total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">No other fees. If anyone asks for extra cash, report it.</p>
        </section>

        <section aria-labelledby="protect" className="rounded-xl bg-brand-soft p-4">
          <h2 id="protect" className="font-semibold text-brand">How your rent is protected</h2>
          <ol className="mt-3 space-y-2 text-sm">
            <li><b>1. You pay through LodgeLock.</b> Our licensed payment partner holds the money. The landlord doesn&apos;t get it yet.</li>
            <li><b>2. You move in and check.</b> If the lodge matches this listing, tap <i>Confirm move-in</i>.</li>
            <li><b>3. The landlord gets paid.</b> If it doesn&apos;t match, raise a dispute within {MOVE_IN_WINDOW_HOURS} hours and we review it before any money moves.</li>
          </ol>
        </section>

        <section aria-labelledby="who" className="space-y-3">
          <h2 id="who" className="font-semibold">Who you&apos;re dealing with</h2>
          {t ? (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                <span>{t.ownerFirstName} · {t.ownerRole === "agent" ? "Agent" : "Landlord"}</span>
                {t.ownerVerified ? <Badge tone="brand">✓ ID verified</Badge> : <Badge tone="muted">Not verified</Badge>}
              </li>
              {t.agentFirstName && (
                <li className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                  <span>{t.agentFirstName} · Agent</span>
                  {t.agentVerified ? <Badge tone="brand">✓ ID verified</Badge> : <Badge tone="muted">Not verified</Badge>}
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted">Verification details unavailable.</p>
          )}
        </section>

        <section aria-labelledby="scout" className="space-y-2">
          <h2 id="scout" className="font-semibold">Scout inspection</h2>
          {t?.inspectedAt && t.checklist ? (
            <>
              <p className="text-sm text-muted">A student scout visited on {dateFmt.format(new Date(t.inspectedAt))}.</p>
              <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {Object.entries(t.checklist).map(([k, ok]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span aria-hidden className={ok ? "text-brand" : "text-danger"}>{ok ? "✓" : "✗"}</span>
                    <span>{CHECKLIST_LABEL[k] ?? k}</span>
                    <span className="sr-only">{ok ? "passed" : "failed"}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">
              No scout has inspected this lodge yet. You&apos;re still protected: your rent is held until you confirm move-in.
            </p>
          )}
        </section>

        {lodge.amenities.length > 0 && (
          <section aria-labelledby="amen">
            <h2 id="amen" className="font-semibold">Amenities</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {lodge.amenities.map((a) => (
                <li key={a} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{AMENITY_LABEL[a] ?? a}</li>
              ))}
            </ul>
          </section>
        )}

        {lodge.description && (
          <section aria-labelledby="about">
            <h2 id="about" className="font-semibold">About this lodge</h2>
            <p className="mt-1 text-sm leading-relaxed">{lodge.description}</p>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-1">
          <div className="text-sm">
            <div className="font-semibold">{formatNaira(total)}</div>
            <div className="text-xs text-muted">held until you move in</div>
          </div>
          {signedIn ? (
            <BookButton lodgeId={lodge.id} />
          ) : (
            <Link href={`/login?next=/lodges/${lodge.id}`} className="rounded-lg bg-brand px-5 py-3 font-semibold text-brand-ink">
              Log in to book
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
