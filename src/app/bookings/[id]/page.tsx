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
import { DisputeForm, HandoverButton } from "./handover";

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
    .select(
      "id,status,rent_kobo,agent_fee_kobo,commitment_fee_kobo,total_kobo,paid_at,move_in_deadline,student_id," +
        "student_keys_confirmed_at,landlord_keys_confirmed_at,lodges(id,title,area,room_type,owner_id,agent_id)",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<BookingRow, { merge: false }>();
  if (!b) notFound();
  const uid = auth.claims.sub;
  const isStudent = b.student_id === uid;
  const isLandlord = !isStudent && (b.lodges?.owner_id === uid || b.lodges?.agent_id === uid);
  if (!isStudent && !isLandlord) notFound();

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
        {b.commitment_fee_kobo > 0 && (
          <div className="flex justify-between text-muted">
            <dt>of which commitment fee (paid to landlord at payment, not held)</dt><dd>{formatNaira(b.commitment_fee_kobo)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt><dd>{formatNaira(b.total_kobo ?? b.rent_kobo + b.agent_fee_kobo)}</dd>
        </div>
      </dl>

      {status === "DRAFT" && isStudent && <PayButton bookingId={b.id} pendingRef={returnedRef} />}

      {status === "PAID_HELD" && (
        <HandoverPanel
          bookingId={b.id}
          isStudent={isStudent}
          studentAt={b.student_keys_confirmed_at}
          landlordAt={b.landlord_keys_confirmed_at}
          deadline={b.move_in_deadline}
          commitmentKobo={b.commitment_fee_kobo}
        />
      )}

      {(status === "MOVE_IN_CONFIRMED" || status === "AUTO_CONFIRMED") && (
        <p className="rounded-xl bg-brand-soft p-4 text-sm text-brand">
          {isStudent
            ? "Done. The landlord's payout has been released. Enjoy your new place!"
            : "Payout released. It's on its way to your verified bank account."}
        </p>
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

type BookingRow = {
  id: string;
  status: BookingStatus;
  rent_kobo: number;
  agent_fee_kobo: number;
  commitment_fee_kobo: number;
  total_kobo: number | null;
  paid_at: string | null;
  move_in_deadline: string | null;
  student_id: string;
  student_keys_confirmed_at: string | null;
  landlord_keys_confirmed_at: string | null;
  lodges: {
    id: string; title: string; area: string; room_type: keyof typeof ROOM_TYPE_LABEL;
    owner_id: string; agent_id: string | null;
  } | null;
};

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={done ? "text-brand" : "text-muted"}>{done ? "✓" : "○"}</span>
      <span>{children}<span className="sr-only">{done ? " (done)" : " (waiting)"}</span></span>
    </li>
  );
}

function HandoverPanel(props: {
  bookingId: string;
  isStudent: boolean;
  studentAt: string | null;
  landlordAt: string | null;
  deadline: string | null;
  commitmentKobo: number;
}) {
  const { bookingId, isStudent, studentAt, landlordAt, deadline, commitmentKobo } = props;
  const mine = isStudent ? studentAt : landlordAt;
  return (
    <section aria-labelledby="handover" className="space-y-3 rounded-xl bg-brand-soft p-4 text-sm">
      <h2 id="handover" className="font-semibold text-brand">
        {isStudent ? "Payment received and held" : "Rent paid and held for you"}
      </h2>
      <p>
        {isStudent
          ? "The landlord hasn't been paid yet. Check that the lodge matches the listing, collect your keys, then confirm below."
          : "Hand over the keys, then confirm below. You're paid the same day once the student confirms too."}
        {commitmentKobo > 0 && !isStudent && ` Your commitment fee of ${formatNaira(commitmentKobo)} was released at payment.`}
      </p>
      <ol className="space-y-1">
        <Step done={!!landlordAt}>Landlord confirmed keys handed over{landlordAt && ` · ${dt.format(new Date(landlordAt))}`}</Step>
        <Step done={!!studentAt}>Student confirmed keys received{studentAt && ` · ${dt.format(new Date(studentAt))}`}</Step>
      </ol>
      {mine ? (
        <p className="font-medium">You&apos;ve confirmed. Waiting for the {isStudent ? "landlord" : "student"}.</p>
      ) : (
        <HandoverButton bookingId={bookingId} label={isStudent ? "I've got the keys and the lodge matches" : "I've handed over the keys"} />
      )}
      {deadline && isStudent && !studentAt && (
        <p className="text-warn">
          The landlord says the keys were handed over. Confirm or raise a dispute by <b>{dt.format(new Date(deadline))}</b>,
          or the booking is confirmed automatically.
        </p>
      )}
      {deadline && !isStudent && (
        <p className="text-muted">If the student doesn&apos;t respond by {dt.format(new Date(deadline))}, it&apos;s confirmed automatically.</p>
      )}
      {isStudent && !studentAt && <DisputeForm bookingId={bookingId} />}
    </section>
  );
}
