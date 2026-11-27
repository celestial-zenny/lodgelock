import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AREAS, GATE_LABEL, LodgeFilters, MAX_BUDGET_OPTIONS, ROOM_TYPE_LABEL, listLodges, walkingMinutes } from "@/lib/lodges";
import { AGENT_FEE_CAP_PCT, formatNaira } from "@/lib/booking/money";
import { TrustBadges } from "@/components/lodge-badges";
import { LodgeVisual } from "@/components/lodge-visual";
import { LodgeCardSkeleton } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { btn, page, pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Verified lodges near FUTO" };

const selectClass =
  "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink focus:border-brand";

export default function LodgesPage({ searchParams }: PageProps<"/lodges">) {
  return (
    <main className={`${page} max-w-6xl`}>
      <h1 className={pageTitle}>Verified lodges near FUTO</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every listing comes from an ID-verified landlord or agent. Agent fees are capped at {AGENT_FEE_CAP_PCT}% of rent,
        and your rent is held until you move in.
      </p>
      <Suspense fallback={<ResultsSkeleton />}>
        <LodgeResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Loading lodges">
      <div className="mt-6 h-11 skeleton rounded-xl" />
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <LodgeCardSkeleton key={i} />)}
      </ul>
    </div>
  );
}

async function LodgeResults({ searchParams }: { searchParams: PageProps<"/lodges">["searchParams"] }) {
  const filters = LodgeFilters.parse(await searchParams);
  const lodges = await listLodges(filters);
  const filtered = Boolean(filters.area || filters.room || filters.max);

  return (
    <>
      <form method="get" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(3,minmax(0,12rem))_max-content]" aria-label="Filter lodges">
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
          <button className={`${btn.small} min-h-11 flex-1 bg-brand px-5 text-brand-ink hover:bg-brand-hover`}>Apply</button>
          {filtered && <Link href="/lodges" className={`${btn.ghost} min-h-11`}>Clear</Link>}
        </div>
      </form>

      <p className="mt-5 text-sm font-medium text-muted" aria-live="polite">
        {lodges.length} {lodges.length === 1 ? "lodge" : "lodges"}{filtered ? " match your filters" : " available"}
      </p>

      {lodges.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="lodges" title="No lodges match these filters"
            action={<Link href="/lodges" className={btn.secondary}>See all lodges</Link>}>
            Try another area or a higher budget. New lodges go live as soon as an admin approves them.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lodges.map((l) => (
            <li key={l.id} className="lift">
              <Link href={`/lodges/${l.id}`}
                className="group block h-full overflow-hidden rounded-2xl border border-line bg-surface hover:border-brand">
                <LodgeVisual area={l.area} roomType={l.room_type} coverUrl={l.coverUrl} className="h-40" />
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="text-lg font-bold leading-tight group-hover:text-brand">{l.title}</h2>
                    <p className="mt-0.5 text-sm text-muted">{ROOM_TYPE_LABEL[l.room_type]} in {l.area}</p>
                    {l.distance_to_gate_m != null && l.nearest_gate && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                        <Icon name="walk" width={16} height={16} />
                        About {walkingMinutes(l.distance_to_gate_m)} min walk to the {GATE_LABEL[l.nearest_gate]}
                      </p>
                    )}
                  </div>
                  <p>
                    <span className="font-display text-[1.75rem] font-semibold leading-none tnum">{formatNaira(l.rent_kobo)}</span>
                    <span className="ml-1 text-sm text-muted">a year</span>
                    <span className="mt-1 block text-sm text-muted">
                      {l.agent_fee_kobo > 0 ? `Plus ${formatNaira(l.agent_fee_kobo)} agent fee` : "No agent fee"}
                    </span>
                  </p>
                  <TrustBadges trust={l.trust} isDemo={l.is_demo} compact />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
