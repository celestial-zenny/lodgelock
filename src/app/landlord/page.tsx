import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/booking/money";
import type { BookingStatus } from "@/lib/booking/state-machine";
import { bookingChip } from "@/lib/booking/status-chip";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton, Skeleton } from "@/components/skeleton";
import { Icon } from "@/components/icons";
import { btn, card, page, pageTitle, sectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

const d = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

const KIND: Record<string, string> = {
  rent: "Rent", agent_fee: "Agent fee", landlord_commission: "Commission", renewal_bonus: "Renewal bonus",
  commitment_fee: "Commitment fee", late_cancel_compensation: "Late-cancellation compensation", refund: "Refund",
};

export default function LandlordDashboard() {
  return (
    <main className={`${page} max-w-5xl`}>
      <h1 className={pageTitle}>Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Content />
      </Suspense>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mt-6 space-y-6">
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      <ListSkeleton rows={3} />
    </div>
  );
}

async function Content() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/landlord");
  const uid = auth.claims.sub;

  const { data: me } = await supabase.from("profiles").select("role,identity_verified_at").eq("id", uid).maybeSingle();
  if (!me || !["landlord", "agent", "caretaker"].includes(me.role)) {
    return (
      <div className="mt-6">
        <EmptyState icon="dashboard" title="This page is for landlords, agents and caretakers"
          action={<Link href="/lodges" className={btn.primary}>Browse lodges</Link>} />
      </div>
    );
  }

  // RLS: lodges the user owns, represents or looks after; bookings on them; their own payouts.
  const [{ data: lodges }, { data: payouts }, { data: bookingRows }] = await Promise.all([
    supabase.from("lodges").select("id,status,review_note")
      .or(`owner_id.eq.${uid},agent_id.eq.${uid},caretaker_id.eq.${uid}`),
    me.role === "caretaker"
      ? Promise.resolve({ data: [] as { id: string; kind: string; amount_kobo: number; status: string; created_at: string; booking_id: string }[] })
      : supabase.from("payout_instructions").select("id,kind,amount_kobo,status,created_at,booking_id")
          .eq("payee_id", uid).order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings")
      .select("id,status,total_kobo,move_in_date,handover_at,created_at,student_id,lodges!inner(title,owner_id,agent_id,caretaker_id)")
      .neq("student_id", uid)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const bookings = (bookingRows ?? []).filter(
    (b) => b.lodges.owner_id === uid || b.lodges.agent_id === uid || b.lodges.caretaker_id === uid,
  );

  const count = (s: string, needsChanges = false) =>
    lodges?.filter((l) => l.status === s && (!needsChanges || l.review_note)).length ?? 0;
  const stats = [
    { label: "Live", value: count("verified") },
    { label: "In review", value: count("pending_review") },
    { label: "Needs changes", value: count("draft", true) },
  ];
  const waitingOnYou = bookings.filter((b) => b.status === "PAID_HELD" && !b.handover_at).length;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-8">
        {me.role !== "caretaker" && !me.identity_verified_at && (
          <div className="flex flex-col gap-3 rounded-2xl bg-brass-soft p-4 text-brass-ink sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-2.5 text-sm font-medium"><Icon name="shield" className="shrink-0" />
              Verify your identity to list lodges and receive payouts. Payouts wait until you do.</p>
            <Link href="/verify" className={`${btn.small} bg-night text-white`}>Verify now</Link>
          </div>
        )}

        <Link href="/landlord/listings" aria-label={`Your listings: ${stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}`}
          className={`${card} flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm hover:border-brand`}>
          <span className="font-semibold">Your listings</span>
          {stats.map((s) => (
            <span key={s.label} className="inline-flex items-baseline gap-1.5 text-muted">
              <span className="font-bold text-ink tnum">{s.value}</span>{s.label.toLowerCase()}
            </span>
          ))}
        </Link>

        <section aria-labelledby="bk">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="bk" className={sectionTitle}>Bookings on your lodges</h2>
            {waitingOnYou > 0 && <p className="text-sm font-semibold text-brass-ink">{waitingOnYou} waiting for keys</p>}
          </div>
          {bookings.length ? (
            <ul className="mt-3 space-y-2.5">
              {bookings.map((b) => (
                <li key={b.id} className="lift">
                  <Link href={`/bookings/${b.id}`} className={`${card} flex items-center justify-between gap-3 p-4 hover:border-brand`}>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{b.lodges.title}</span>
                      <span className="block text-sm text-muted">Move-in {d.format(new Date(b.move_in_date))}</span>
                      {b.total_kobo != null && <span className="mt-0.5 block font-display text-lg font-extrabold tnum">{formatNaira(b.total_kobo)}</span>}
                    </span>
                    <StatusChip {...bookingChip(b.status as BookingStatus, b.handover_at)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <EmptyState icon="bookings" title="No bookings yet">
                When a student books one of your live lodges, it shows here. Hand over the keys, then mark it on the booking.
              </EmptyState>
            </div>
          )}
        </section>

        {me.role !== "caretaker" && (
          <section aria-labelledby="payouts">
            <h2 id="payouts" className={sectionTitle}>Payouts</h2>
            {payouts && payouts.length > 0 ? (
              <ul className={`${card} mt-3 divide-y divide-line text-sm`}>
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <Link href={`/bookings/${p.booking_id}`} className="font-semibold underline-offset-2 hover:underline">{KIND[p.kind] ?? p.kind}</Link>
                      <p className="text-xs text-muted">
                        {d.format(new Date(p.created_at))}, {p.status === "awaiting_kyc" ? "waiting for your identity check" : p.status}
                      </p>
                    </div>
                    <span className="font-display text-lg font-extrabold tnum">{formatNaira(p.amount_kobo)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No payouts yet. They appear when a student confirms move-in.</p>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <section aria-labelledby="how" className="rounded-2xl bg-night p-5 text-sm text-night-muted">
          <h2 id="how" className="font-display text-xl font-extrabold text-white">How listing works</h2>
          <ol className="mt-3 space-y-3">
            {[
              "List your lodge with photos.",
              "An admin approves it and it goes live.",
              "A scout visit adds an inspected badge. It isn't required to go live.",
            ].map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brass font-display text-sm font-extrabold text-night">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-white/15 pt-3">Editing a live lodge sends it back to review, so students always book what was checked.</p>
        </section>
        {me.role !== "caretaker" && (
          <Link href="/landlord/listings/new" className={`${btn.primary} w-full`}><Icon name="plus" />List a lodge</Link>
        )}
      </aside>
    </div>
  );
}
