import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira, releaseSplit } from "@/lib/booking/money";
import {
  AUTO_RELEASE_HOURS, CANCEL_GRACE_HOURS, LATE_CANCEL_PCT, NO_SHOW_DAYS, STATUS_LABEL, type BookingStatus,
} from "@/lib/booking/state-machine";
import { ROOM_TYPE_LABEL } from "@/lib/lodges";
import { PayButton } from "./pay-button";
import { CancelForm, DisputeForm, RpcButton } from "./handover";
import { BookButton } from "@/app/lodges/[id]/book-button";

export const metadata: Metadata = { title: "Your booking — LodgeLock" };

const dateOnly = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
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

  // RLS: only the student, the lodge's landlord/agent/caretaker, or an admin can read it.
  const { data: b } = await supabase
    .from("bookings")
    .select(
      "id,status,rent_kobo,agent_fee_kobo,commitment_fee_kobo,agent_commission_kobo,total_kobo,paid_at,auto_release_at," +
        "student_id,student_confirmed_at,handover_at,move_in_date,renewal_of,agent_id,cancellation_kind," +
        "lodges(id,title,area,room_type,owner_id,agent_id,caretaker_id)",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<BookingRow, { merge: false }>();
  if (!b) notFound();
  const uid = auth.claims.sub;
  const viewer: Viewer | null =
    b.student_id === uid ? "student"
    : b.lodges?.owner_id === uid ? "landlord"
    : b.lodges?.agent_id === uid ? "agent"
    : b.lodges?.caretaker_id === uid ? "caretaker"
    : null;
  if (!viewer) notFound();

  const [{ data: events }, { data: myPayouts }, { data: renewal }] = await Promise.all([
    supabase.from("booking_events").select("id,to_status,created_at").eq("booking_id", id).order("id"),
    // RLS: only the viewer's own payout instructions come back.
    supabase.from("payout_instructions").select("id,kind,amount_kobo,status").eq("booking_id", id).eq("payee_id", uid),
    supabase.from("bookings").select("id,status").eq("renewal_of", id).not("status", "in", "(CANCELLED,STUDENT_CANCELLED,REFUNDED)").maybeSingle(),
  ]);

  const lodge = b.lodges;
  const status = b.status;
  const returnedRef = typeof sp.ref === "string" && /^LL-[0-9A-F]{16}$/.test(sp.ref) ? sp.ref : null;
  const split = releaseSplit({
    rentKobo: b.rent_kobo, agentFeeKobo: b.agent_fee_kobo, agentCommissionKobo: b.agent_commission_kobo,
    commitmentFeeKobo: b.commitment_fee_kobo, hasAgent: !!b.agent_id,
  });
  const done = status === "MOVE_IN_CONFIRMED" || status === "AUTO_CONFIRMED" || status === "PAID_OUT";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/bookings" className="text-sm text-muted underline">← My bookings</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lodge?.title}</h1>
        {lodge && <p className="text-muted">{ROOM_TYPE_LABEL[lodge.room_type]} · {lodge.area}</p>}
        <p className="text-sm text-muted">
          Move-in date: {dateOnly.format(new Date(b.move_in_date))}{b.renewal_of && " · Renewal"}
        </p>
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

      {(viewer === "landlord" || viewer === "agent") && (
        <PayoutSplit viewer={viewer} split={split} commitment={b.commitment_fee_kobo} isRenewal={!!b.renewal_of}
          payouts={myPayouts ?? []} />
      )}

      {status === "DRAFT" && viewer === "student" && <PayButton bookingId={b.id} pendingRef={returnedRef} />}

      {status === "PAID_HELD" && (
        <HeldPanel bookingId={b.id} viewer={viewer} handoverAt={b.handover_at} autoReleaseAt={b.auto_release_at}
          paidAt={b.paid_at} moveInDate={b.move_in_date} rentKobo={b.rent_kobo} commitmentKobo={b.commitment_fee_kobo} />
      )}

      {done && (
        <p className="rounded-xl bg-brand-soft p-4 text-sm text-brand">
          {viewer === "student"
            ? "Done. The landlord's payout has been released. Enjoy your new place!"
            : viewer === "caretaker"
              ? "Move-in complete."
              : "Payout released. It goes to your KYC-verified bank account."}
        </p>
      )}

      {status === "STUDENT_CANCELLED" && (
        <p className="rounded-xl bg-warn-soft p-4 text-sm text-warn">
          {b.cancellation_kind === "grace"
            ? "Cancelled within the grace period. Everything held has been refunded."
            : b.cancellation_kind === "no_show"
              ? `Cancelled as a no-show (no move-in within ${NO_SHOW_DAYS} days of the move-in date). The landlord receives ${LATE_CANCEL_PCT}% of rent; the rest is refunded.`
              : `Cancelled after the grace period. The landlord receives ${LATE_CANCEL_PCT}% of rent; the rest is refunded.`}
          {viewer === "student" && myPayouts && myPayouts.length > 0 && (
            <> Refund: <b>{formatNaira(myPayouts.reduce((n, p) => n + p.amount_kobo, 0))}</b>.</>
          )}
        </p>
      )}

      {done && viewer === "student" && lodge && !renewal && (
        <section aria-labelledby="renew" className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 id="renew" className="font-semibold">Staying another year?</h2>
          <p className="text-muted">Renew through LodgeLock: no agent fee, and your rent is protected the same way.</p>
          <BookButton lodgeId={lodge.id} renewalOf={b.id} label="Renew" />
        </section>
      )}
      {renewal && viewer === "student" && (
        <Link href={`/bookings/${renewal.id}`} className="block text-sm text-brand underline">View your renewal →</Link>
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

type Viewer = "student" | "landlord" | "agent" | "caretaker";

type BookingRow = {
  id: string;
  status: BookingStatus;
  rent_kobo: number;
  agent_fee_kobo: number;
  commitment_fee_kobo: number;
  agent_commission_kobo: number;
  total_kobo: number | null;
  paid_at: string | null;
  auto_release_at: string | null;
  student_id: string;
  student_confirmed_at: string | null;
  handover_at: string | null;
  move_in_date: string;
  renewal_of: string | null;
  agent_id: string | null;
  cancellation_kind: "grace" | "late" | "no_show" | null;
  lodges: {
    id: string; title: string; area: string; room_type: keyof typeof ROOM_TYPE_LABEL;
    owner_id: string; agent_id: string | null; caretaker_id: string | null;
  } | null;
};

const PAYOUT_KIND: Record<string, string> = {
  rent: "Rent", agent_fee: "Agent fee (paid by student)", landlord_commission: "Commission (paid by landlord)",
  renewal_bonus: "Renewal bonus", commitment_fee: "Commitment fee", late_cancel_compensation: "Late-cancellation compensation",
  refund: "Refund",
};

function PayoutSplit({ viewer, split, commitment, isRenewal, payouts }: {
  viewer: "landlord" | "agent";
  split: ReturnType<typeof releaseSplit>;
  commitment: number;
  isRenewal: boolean;
  payouts: { id: string; kind: string; amount_kobo: number; status: string }[];
}) {
  return (
    <section aria-labelledby="split" className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
      <h2 id="split" className="font-semibold">How the payment is split at release</h2>
      <dl className="space-y-1">
        <div className="flex justify-between"><dt>Rent to landlord{viewer === "agent" && " (or you, under a signed payee mandate)"}</dt><dd>{formatNaira(split.rentToPayee)}</dd></div>
        {commitment > 0 && <div className="flex justify-between text-muted"><dt>+ commitment fee, paid at payment</dt><dd>{formatNaira(commitment)}</dd></div>}
        {split.agentFee > 0 && <div className="flex justify-between"><dt>Agent fee (paid by student)</dt><dd>{formatNaira(split.agentFee)}</dd></div>}
        {split.agentCommission > 0 && (
          <div className="flex justify-between">
            <dt>{isRenewal ? "Renewal bonus to agent (2.5% of rent)" : "Commission to agent (from landlord's rent)"}</dt>
            <dd>{formatNaira(split.agentCommission)}</dd>
          </div>
        )}
      </dl>
      {payouts.length > 0 && (
        <>
          <h3 className="pt-2 font-semibold">Your payouts</h3>
          <ul className="space-y-1">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{PAYOUT_KIND[p.kind] ?? p.kind}{p.status === "awaiting_kyc" && <span className="text-warn"> · waiting for your KYC</span>}</span>
                <span className="font-medium">{formatNaira(p.amount_kobo)}</span>
              </li>
            ))}
          </ul>
          {payouts.some((p) => p.status === "awaiting_kyc") && (
            <Link href="/verify" className="text-brand underline">Finish identity verification to get paid →</Link>
          )}
        </>
      )}
    </section>
  );
}

function HeldPanel(props: {
  bookingId: string;
  viewer: Viewer;
  handoverAt: string | null;
  autoReleaseAt: string | null;
  paidAt: string | null;
  moveInDate: string;
  rentKobo: number;
  commitmentKobo: number;
}) {
  const { bookingId, viewer, handoverAt, autoReleaseAt, rentKobo, commitmentKobo } = props;
  const lateComp = Math.max(0, Math.floor(rentKobo / 10) - commitmentKobo);
  if (viewer !== "student") {
    return (
      <section aria-labelledby="held" className="space-y-3 rounded-xl bg-brand-soft p-4 text-sm">
        <h2 id="held" className="font-semibold text-brand">Rent paid and held</h2>
        {handoverAt ? (
          <p>
            Keys handed over {dt.format(new Date(handoverAt))}. The payment is released when the student confirms, or
            automatically {autoReleaseAt && <>on <b>{dt.format(new Date(autoReleaseAt))}</b></>} if they don&apos;t respond.
          </p>
        ) : (
          <>
            <p>Hand over the keys, then tap below. The student confirms and the payment is released. If they don&apos;t respond within {AUTO_RELEASE_HOURS} hours, it&apos;s released automatically.</p>
            <RpcButton action="handover" bookingId={bookingId} label="Keys handed over" />
          </>
        )}
        {viewer === "caretaker" && <p className="text-muted">As caretaker you can mark the handover. Payouts go only to the landlord and agent.</p>}
      </section>
    );
  }
  return (
    <section aria-labelledby="held" className="space-y-3 rounded-xl bg-brand-soft p-4 text-sm">
      <h2 id="held" className="font-semibold text-brand">Payment received and held</h2>
      <p>The landlord hasn&apos;t been paid. Collect your keys, check the lodge matches the listing, then confirm.</p>
      {handoverAt && autoReleaseAt && (
        <p className="text-warn">
          Keys were marked handed over {dt.format(new Date(handoverAt))}. Confirm or raise a dispute by{" "}
          <b>{dt.format(new Date(autoReleaseAt))}</b>, or the payment is released automatically.
        </p>
      )}
      <RpcButton action="confirm" bookingId={bookingId} label="I've moved in and it matches. Release payment" />
      <DisputeForm bookingId={bookingId} />
      <CancelForm bookingId={bookingId}
        graceNote={`Free within ${CANCEL_GRACE_HOURS} hours of paying, if you haven't received the keys. Otherwise the landlord keeps ${lateComp > 0 ? formatNaira(lateComp) : "nothing more"} (${LATE_CANCEL_PCT}% of rent${commitmentKobo > 0 ? ", less the commitment fee already paid" : ""}) and the rest is refunded.`} />
    </section>
  );
}
