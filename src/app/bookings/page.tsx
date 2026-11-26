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
import { ListSkeleton } from "@/components/skeleton";
import { btn, page, pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  return (
    <main className={`${page} max-w-2xl`}>
      <h1 className={pageTitle}>My bookings</h1>
      <div className="mt-6">
        <Suspense fallback={<ListSkeleton label="Loading bookings" />}>
          <BookingList />
        </Suspense>
      </div>
    </main>
  );
}

async function BookingList() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/bookings");

  // Students see their bookings; landlords/agents/caretakers see bookings on their lodges (RLS allows all).
  // Filter explicitly so an admin's view here is still just their own.
  const uid = auth.claims.sub;
  const { data: rows } = await supabase
    .from("bookings")
    .select("id,status,total_kobo,created_at,handover_at,student_id,lodges(title,area,owner_id,agent_id,caretaker_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  const bookings = rows?.filter(
    (b) => b.student_id === uid || b.lodges?.owner_id === uid || b.lodges?.agent_id === uid
      || b.lodges?.caretaker_id === uid,
  );

  if (!bookings?.length) {
    return (
      <EmptyState icon="bookings" title="No bookings yet" action={<Link href="/lodges" className={btn.primary}>Browse lodges</Link>}>
        When you book a lodge it shows here, with where your rent is at every step.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const chip = bookingChip(b.status as BookingStatus, b.handover_at);
        return (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{b.lodges?.title}</p>
                <p className="text-sm text-muted">
                  {b.lodges?.area}{b.student_id === uid ? "" : ", on your lodge"}
                </p>
                <p className="mt-1 font-display text-xl font-extrabold tnum">{b.total_kobo != null && formatNaira(b.total_kobo)}</p>
              </div>
              <StatusChip {...chip} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
