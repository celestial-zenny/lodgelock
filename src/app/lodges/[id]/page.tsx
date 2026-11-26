import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AMENITY_LABEL, CHECKLIST_LABEL, GATE_LABEL, ROOM_TYPE_LABEL, getLodge, walkingMinutes } from "@/lib/lodges";
import { AGENT_FEE_CAP_PCT, commitmentFeeKobo, formatNaira } from "@/lib/booking/money";
import { AUTO_RELEASE_HOURS, CANCEL_GRACE_HOURS, LATE_CANCEL_PCT, NO_SHOW_DAYS } from "@/lib/booking/state-machine";
import { createUserClient } from "@/lib/supabase/server";
import { Badge, TrustBadges } from "@/components/lodge-badges";
import { LodgeVisual } from "@/components/lodge-visual";
import { RentTrack } from "@/components/rent-track";
import { Skeleton } from "@/components/skeleton";
import { Icon } from "@/components/icons";
import { btn, card, sectionTitle } from "@/components/ui";
import { BookButton } from "./book-button";

export async function generateMetadata({ params }: PageProps<"/lodges/[id]">): Promise<Metadata> {
  const lodge = await getLodge((await params).id);
  return { title: lodge ? `${lodge.title}, ${lodge.area}` : "Lodge not found" };
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
    <main className="mx-auto w-full max-w-6xl flex-1 pb-tabbar lg:px-6 lg:pt-6" role="status" aria-label="Loading lodge">
      <Skeleton className="h-56 rounded-none sm:h-72 lg:rounded-2xl" />
      <div className="grid gap-8 px-4 pt-5 lg:grid-cols-[1fr_22rem] lg:px-0">
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="hidden h-72 rounded-2xl lg:block" />
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
  const commitment = commitmentFeeKobo(lodge.rent_kobo, lodge.commitment_fee_pct);
  const heldNote = commitment > 0 ? `${formatNaira(total - commitment)} held until you move in` : "Held until you move in";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 pb-tabbar lg:px-6 lg:pt-6">
      <div className="relative">
        {lodge.photos.length > 1 ? (
          <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto lg:rounded-2xl" aria-label="Photos">
            {lodge.photos.map((p, i) => (
              <li key={p.id} className="h-64 w-[88%] shrink-0 snap-start sm:h-80 lg:w-[60%]">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URLs */}
                <img src={p.url} alt={`${lodge.title}, photo ${i + 1}`} className="size-full object-cover" />
              </li>
            ))}
          </ul>
        ) : (
          <LodgeVisual area={lodge.area} roomType={lodge.room_type} coverUrl={lodge.photos[0]?.url}
            className="h-56 sm:h-72 lg:rounded-2xl" />
        )}
        <Link href="/lodges"
          className="absolute top-3 left-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface/95 px-3.5 text-sm font-semibold text-ink shadow-sm">
          <Icon name="arrow-left" width={16} height={16} />All lodges
        </Link>
      </div>

      <div className="grid gap-8 px-4 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-0 lg:pt-8">
        <div className="min-w-0 space-y-8">
          <header>
            <h1 className="font-display text-4xl font-extrabold leading-[1] sm:text-5xl">{lodge.title}</h1>
            <p className="mt-2 flex items-start gap-1.5 text-muted">
              <Icon name="pin" width={18} height={18} className="mt-0.5 shrink-0" />
              <span>{ROOM_TYPE_LABEL[lodge.room_type]} at {lodge.address}</span>
            </p>
            {lodge.distance_to_gate_m != null && lodge.nearest_gate && (
              <p className="mt-1 flex items-center gap-1.5 text-muted">
                <Icon name="walk" width={18} height={18} className="shrink-0" />
                About {walkingMinutes(lodge.distance_to_gate_m)} min walk ({(lodge.distance_to_gate_m / 1000).toFixed(1)} km)
                to the FUTO {GATE_LABEL[lodge.nearest_gate]}
              </p>
            )}
            <div className="mt-4"><TrustBadges trust={t} isDemo={lodge.is_demo} /></div>
            {lodge.is_demo && (
              <p className="mt-3 text-sm text-brass-ink">Sample listing for the LodgeLock prototype. It isn&apos;t a real lodge, and the price is illustrative.</p>
            )}
          </header>

          <section aria-labelledby="price" className={`${card} p-5 lg:hidden`}>
            <h2 id="price" className={sectionTitle}>What you pay</h2>
            <PriceTable rent={lodge.rent_kobo} fee={lodge.agent_fee_kobo} total={total} />
            <CommitmentNote commitment={commitment} pct={lodge.commitment_fee_pct} total={total} />
          </section>

          <section aria-labelledby="protect" className="on-dark rounded-2xl bg-night p-5 text-white sm:p-7">
            <h2 id="protect" className="font-display text-2xl font-extrabold">Your rent is held, not handed over</h2>
            <p className="mt-1.5 text-night-muted">LodgeLock&apos;s licensed payment partner keeps the money until you&apos;re in.</p>
            <RentTrack current={1} dark className="mt-6" />
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-night-muted">
              <li className="flex gap-3"><Icon name="key" className="mt-0.5 shrink-0 text-brass" />
                <span>Collect the keys and check the lodge. Confirm it matches and the landlord is paid; if not, raise a dispute and nothing moves until it&apos;s reviewed.</span></li>
              <li className="flex gap-3"><Icon name="lock" className="mt-0.5 shrink-0 text-brass" />
                <span>Once the keys are marked handed over you have <b className="text-white">{AUTO_RELEASE_HOURS} hours</b> to confirm or dispute. After that the rent is released automatically.</span></li>
              <li className="flex gap-3"><Icon name="info" className="mt-0.5 shrink-0 text-brass" />
                <span>Cancel free within {CANCEL_GRACE_HOURS} hours of paying, before you get the keys. After that the landlord keeps <b className="text-white">{LATE_CANCEL_PCT}% of rent</b> as compensation and the rest is refunded. The same applies if no handover happens within {NO_SHOW_DAYS} days of your move-in date.</span></li>
            </ul>
          </section>

          <section aria-labelledby="who">
            <h2 id="who" className={sectionTitle}>Who you&apos;re dealing with</h2>
            {t ? (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
                <PersonRow name={t.ownerFirstName} role={t.ownerRole === "agent" ? "Agent" : "Landlord"} verified={t.ownerVerified} />
                {t.agentFirstName && <PersonRow name={t.agentFirstName} role="Agent" verified={Boolean(t.agentVerified)} />}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Verification details unavailable.</p>
            )}
          </section>

          <section aria-labelledby="scout">
            <h2 id="scout" className={sectionTitle}>Scout inspection</h2>
            {t?.inspectedAt && t.checklist ? (
              <>
                <p className="mt-1 text-sm text-muted">A student scout visited on {dateFmt.format(new Date(t.inspectedAt))}.</p>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(t.checklist).map(([k, ok]) => (
                    <li key={k} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-line">
                      <span aria-hidden className={`grid size-6 place-items-center rounded-full ${ok ? "bg-leaf-soft text-leaf" : "bg-signal-soft text-signal"}`}>
                        <Icon name={ok ? "check" : "close"} width={14} height={14} strokeWidth={2.4} />
                      </span>
                      <span>{CHECKLIST_LABEL[k] ?? k}</span>
                      <span className="sr-only">{ok ? "passed" : "failed"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                No scout has inspected this lodge yet. You&apos;re still protected: your rent is held until you confirm you&apos;ve moved in.
              </p>
            )}
          </section>

          {lodge.amenities.length > 0 && (
            <section aria-labelledby="amen">
              <h2 id="amen" className={sectionTitle}>Amenities</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {lodge.amenities.map((a) => (
                  <li key={a} className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium ring-1 ring-line">{AMENITY_LABEL[a] ?? a}</li>
                ))}
              </ul>
            </section>
          )}

          {lodge.description && (
            <section aria-labelledby="about">
              <h2 id="about" className={sectionTitle}>About this lodge</h2>
              <p className="mt-2 max-w-prose leading-relaxed">{lodge.description}</p>
            </section>
          )}
        </div>

        {/* Desktop: price and booking stay in view. */}
        <aside className="hidden lg:block" aria-label="Book this lodge">
          <div className={`${card} sticky top-20 space-y-4 p-5`}>
            <h2 className={sectionTitle}>What you pay</h2>
            <PriceTable rent={lodge.rent_kobo} fee={lodge.agent_fee_kobo} total={total} />
            <CommitmentNote commitment={commitment} pct={lodge.commitment_fee_pct} total={total} />
            <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-medium text-brand">
              <Icon name="lock" width={18} height={18} />{heldNote}
            </p>
            {signedIn ? <BookButton lodgeId={lodge.id} layout="stacked" /> : (
              <Link href={`/login?next=/lodges/${lodge.id}`} className={`${btn.primary} w-full`}>Log in to book</Link>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile: booking bar above the tab bar. */}
      <div className="fixed inset-x-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden"
        style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-none tnum">{formatNaira(total)}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{heldNote}</p>
          </div>
          {signedIn ? <BookButton lodgeId={lodge.id} label="Book" /> : (
            <Link href={`/login?next=/lodges/${lodge.id}`} className={btn.primary}>Log in to book</Link>
          )}
        </div>
      </div>
      {/* Room for the booking bar so it never covers the last section. */}
      <div aria-hidden className="h-20 lg:hidden" />
    </main>
  );
}

function PriceTable({ rent, fee, total }: { rent: number; fee: number; total: number }) {
  return (
    <dl className="mt-3 space-y-2.5 text-sm tnum">
      <div className="flex justify-between gap-4"><dt>Rent for 1 year</dt><dd className="font-medium">{formatNaira(rent)}</dd></div>
      <div className="flex justify-between gap-4">
        <dt>Agent fee <span className="text-muted">(capped at {AGENT_FEE_CAP_PCT}%)</span></dt>
        <dd className="font-medium">{fee > 0 ? formatNaira(fee) : "None"}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <dt className="font-semibold">Total</dt>
        <dd className="font-display text-2xl font-extrabold">{formatNaira(total)}</dd>
      </div>
      <p className="text-xs text-muted">No other fees. If anyone asks you for extra cash, report it.</p>
    </dl>
  );
}

function CommitmentNote({ commitment, pct, total }: { commitment: number; pct: number; total: number }) {
  if (commitment <= 0) return null;
  return (
    <p className="mt-3 rounded-xl bg-brass-soft px-3 py-2.5 text-sm text-brass-ink">
      <b>Commitment fee: {formatNaira(commitment)}</b> ({pct}% of rent, part of the total above). This landlord asks
      for it to reserve the lodge. It goes to them as soon as you pay and is <b>not</b> held, so it can&apos;t be
      refunded through LodgeLock if you later dispute. The other {formatNaira(total - commitment)} is held.
    </p>
  );
}

function PersonRow({ name, role, verified }: { name: string; role: string; verified: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-brand-soft font-display font-bold text-brand">
          {name.charAt(0)}
        </span>
        <span><span className="block font-semibold">{name}</span><span className="block text-sm text-muted">{role}</span></span>
      </span>
      {verified ? <Badge tone="brand" icon="shield">ID verified</Badge> : <Badge tone="muted">Not verified</Badge>}
    </li>
  );
}
