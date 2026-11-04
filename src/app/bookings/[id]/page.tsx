import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/booking/money";
import { STATUS_LABEL, type BookingStatus } from "@/lib/booking/state-machine";
import { ROOM_TYPE_LABEL } from "@/lib/lodges";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { title: "Your booking — LodgeLock" };

const dt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
});

export default function BookingPage(props: PageProps<"/bookings/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <BookingDetail {...props} />
      </Suspense>
    </main>
  );
}

async function BookingDetail({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/bookings/${id}`);

  // RLS: returns nothing unless this is the student's own booking (or the landlord's/admin's).
  const { data: b } = await supabase
    .from("bookings")
    .select("id,status,rent_kobo,agent_fee_kobo,total_kobo,paid_at,move_in_deadline,student_id,lodges(id,title,area,room_type)")
    .eq("id", id)
    .maybeSingle();
  if (!b || b.student_id !== auth.claims.sub) notFound();

  const { data: events } = await supabase
    .from("booking_events")
    .select("id,to_status,created_at")
    .eq("booking_id", id)
    .order("id");

  const lodge = b.lodges;
  const status = b.status as BookingStatus;
  const returnedRef = typeof sp.ref === "string" && /^LL-[0-9A-F]{16}$/.test(sp.ref) ? sp.ref : null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/bookings" className="text-sm text-muted underline">← My bookings</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lodge?.title}</h1>
        {lodge && <p className="text-muted">{ROOM_TYPE_LABEL[lodge.room_type]} · {lodge.area}</p>}
      </div>

      <p className={`rounded-lg px-3 py-2 text-sm font-medium ${status === "DRAFT" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand"}`}>
        {STATUS_LABEL[status]}
      </p>

      <dl className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between"><dt>Rent (1 year)</dt><dd>{formatNaira(b.rent_kobo)}</dd></div>
        <div className="flex justify-between"><dt>Agent fee</dt><dd>{b.agent_fee_kobo > 0 ? formatNaira(b.agent_fee_kobo) : "None"}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt><dd>{formatNaira(b.total_kobo ?? b.rent_kobo + b.agent_fee_kobo)}</dd>
        </div>
      </dl>

      {status === "DRAFT" && <PayButton bookingId={b.id} pendingRef={returnedRef} />}

      {status === "PAID_HELD" && b.move_in_deadline && (
        <div className="rounded-xl bg-brand-soft p-4 text-sm">
          <p className="font-semibold text-brand">Payment received and held</p>
          <p className="mt-1">
            The landlord hasn&apos;t been paid. Move in and check that the lodge matches the listing.
            You have until <b>{dt.format(new Date(b.move_in_deadline))}</b> to confirm or raise a dispute.
            If you don&apos;t respond by then, the booking is confirmed automatically.
          </p>
        </div>
      )}

      {events && events.length > 0 && (
        <section aria-labelledby="hist">
          <h2 id="hist" className="text-sm font-semibold">History</h2>
          <ol className="mt-2 space-y-1 border-l border-line pl-4 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{STATUS_LABEL[e.to_status as BookingStatus]}</span>{" "}
                <span className="text-muted">· {dt.format(new Date(e.created_at))}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
