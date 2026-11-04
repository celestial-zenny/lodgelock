import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AREAS, GATE_LABEL, LodgeFilters, MAX_BUDGET_OPTIONS, ROOM_TYPE_LABEL, listLodges, walkingMinutes } from "@/lib/lodges";
import { formatNaira } from "@/lib/booking/money";
import { TrustBadges } from "@/components/lodge-badges";
import { LodgeVisual } from "@/components/lodge-visual";

export const metadata: Metadata = { title: "Verified lodges near FUTO — LodgeLock" };

const selectClass = "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm";

export default function LodgesPage({ searchParams }: PageProps<"/lodges">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Verified lodges near FUTO</h1>
      <p className="mt-1 text-sm text-muted">Every listing comes from an ID-verified landlord or agent. Agent fees are capped at 5%.</p>
      <Suspense fallback={<ResultsSkeleton />}>
        <LodgeResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading lodges">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
      ))}
    </ul>
  );
}

async function LodgeResults({ searchParams }: { searchParams: PageProps<"/lodges">["searchParams"] }) {
  const filters = LodgeFilters.parse(await searchParams);
  const lodges = await listLodges(filters);
  const filtered = Boolean(filters.area || filters.room || filters.max);

  return (
    <>

      <form method="get" className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Filter lodges">
        <select name="area" defaultValue={filters.area ?? ""} className={selectClass} aria-label="Area">
          <option value="">All areas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="room" defaultValue={filters.room ?? ""} className={selectClass} aria-label="Room type">
          <option value="">Any room type</option>
          {Object.entries(ROOM_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="max" defaultValue={filters.max ? String(filters.max) : ""} className={selectClass} aria-label="Budget">
          <option value="">Any budget</option>
          {MAX_BUDGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink">Apply</button>
          {filtered && <Link href="/lodges" className="rounded-lg px-3 py-2.5 text-sm text-muted underline">Clear</Link>}
        </div>
      </form>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {lodges.length} {lodges.length === 1 ? "lodge" : "lodges"}{filtered ? " match your filters" : ""}
      </p>

      {lodges.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-muted">
          No lodges match these filters. <Link href="/lodges" className="text-brand underline">See all lodges</Link>
        </div>
      ) : (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lodges.map((l) => (
            <li key={l.id}>
              <Link href={`/lodges/${l.id}`}
                className="block overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand">
                <LodgeVisual area={l.area} roomType={l.room_type} className="h-32" />
                <div className="space-y-2 p-4">
                  <div>
                    <h2 className="font-semibold leading-tight">{l.title}</h2>
                    <p className="text-sm text-muted">
                      {ROOM_TYPE_LABEL[l.room_type]} · {l.area}
                      {l.distance_to_gate_m != null && l.nearest_gate &&
                        ` · ~${walkingMinutes(l.distance_to_gate_m)} min walk to ${GATE_LABEL[l.nearest_gate]}`}
                    </p>
                  </div>
                  <p>
                    <span className="text-lg font-semibold">{formatNaira(l.rent_kobo)}</span>
                    <span className="text-sm text-muted">/year</span>
                    <span className="ml-2 text-xs text-muted">
                      {l.agent_fee_kobo > 0 ? `+ ${formatNaira(l.agent_fee_kobo)} agent fee` : "No agent fee"}
                    </span>
                  </p>
                  <TrustBadges trust={l.trust} isDemo={l.is_demo} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
