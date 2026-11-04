import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/booking/money";
import { STATUS_LABEL, type BookingStatus } from "@/lib/booking/state-machine";

export const metadata: Metadata = { title: "My bookings — LodgeLock" };

export default function BookingsPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
      <Suspense fallback={<div className="mt-4 h-40 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <BookingList />
      </Suspense>
    </main>
  );
}

async function BookingList() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/bookings");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,status,total_kobo,created_at,lodges(title,area)")
    .eq("student_id", auth.claims.sub)
    .order("created_at", { ascending: false });

  if (!bookings?.length) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-center text-muted">
        No bookings yet. <Link href="/lodges" className="text-brand underline">Browse lodges</Link>
      </p>
    );
  }
  return (
    <ul className="mt-4 space-y-3">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link href={`/bookings/${b.id}`} className="block rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{b.lodges?.title}</p>
                <p className="text-sm text-muted">{b.lodges?.area}</p>
              </div>
              <p className="font-semibold">{b.total_kobo != null && formatNaira(b.total_kobo)}</p>
            </div>
            <p className="mt-2 text-sm text-muted">{STATUS_LABEL[b.status as BookingStatus]}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
