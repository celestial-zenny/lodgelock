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
import { bookingChip } from "@/lib/booking/status-chip";
import { StatusChip } from "@/components/status-chip";
import { RentTrack, trackStep } from "@/components/rent-track";
import { PanelSkeleton } from "@/components/skeleton";
import { Icon } from "@/components/icons";
import { card, page, sectionTitle } from "@/components/ui";
import { PayButton } from "./pay-button";
import { CancelForm, DisputeForm, RpcButton } from "./handover";
import { BookButton } from "@/app/lodges/[id]/book-button";

export const metadata: Metadata = { title: "Your booking" };

const dateOnly = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
});

export default function BookingPage(props: PageProps<"/bookings/[id]">) {
  return (
    <main className={`${page} max-w-2xl`}>
      <Suspense fallback={<PanelSkeleton label="Loading booking" />}>
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
  const chip = bookingChip(status, b.handover_at);
  const step = trackStep(status, b.handover_at);

  return (
    <div className="space-y-6">
      <div>
        <Link href={viewer === "student" ? "/bookings" : "/landlord"} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
          <Icon name="arrow-left" width={16} height={16} />{viewer === "student" ? "My bookings" : "Dashboard"}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-4xl font-extrabold leading-[1]">{lodge?.title}</h1>
          <StatusChip {...chip} className="mt-1.5" />
        </div>
        {lodge && <p className="mt-2 text-muted">{ROOM_TYPE_LABEL[lodge.room_type]} in {lodge.area}</p>}
        <p className="text-sm text-muted">
          Move-in date: {dateOnly.format(new Date(b.move_in_date))}{b.renewal_of && ". Renewal"}
        </p>
      </div>

      <section aria-label="Where your money is" className={`${card} p-5`}>
        {step !== null && <RentTrack current={step} />}
        <p className={`${step !== null ? "mt-5 border-t border-line pt-4" : ""} text-sm font-medium`}>{STATUS_LABEL[status]}</p>
      </section>

      <dl className={`${card} space-y-2.5 p-5 text-sm tnum`}>
        <div className="flex justify-between gap-4"><dt>Rent for 1 year</dt><dd className="font-medium">{formatNaira(b.rent_kobo)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Agent fee</dt><dd className="font-medium">{b.agent_fee_kobo > 0 ? formatNaira(b.agent_fee_kobo) : "None"}</dd></div>
        {b.commitment_fee_kobo > 0 && (
          <div className="flex justify-between gap-4 text-muted">
            <dt>of which commitment fee (paid to landlord at payment, not held)</dt><dd>{formatNaira(b.commitment_fee_kobo)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-2xl font-extrabold">{formatNaira(b.total_kobo ?? b.rent_kobo + b.agent_fee_kobo)}</dd>
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
        <p className="flex gap-3 rounded-2xl bg-leaf-soft p-4 text-sm font-medium text-leaf">
          <Icon name="check" className="shrink-0" />
          {viewer === "student"
            ? "Done. The landlord's payout has been released. Enjoy your new place!"
            : viewer === "caretaker"
              ? "Move-in complete."
              : "Payout released. It goes to your KYC-verified bank account."}
        </p>
      )}

      {status === "STUDENT_CANCELLED" && (
        <p className="rounded-2xl bg-brass-soft p-4 text-sm text-brass-ink">
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
        <section aria-labelledby="renew" className={`${card} space-y-3 p-5 text-sm`}>
          <h2 id="renew" className={sectionTitle}>Staying another year?</h2>
          <p className="text-muted">Renew through LodgeLock: no agent fee, and your rent is protected the same way.</p>
          <BookButton lodgeId={lodge.id} renewalOf={b.id} label="Renew" layout="stacked" />
        </section>
      )}
      {renewal && viewer === "student" && (
        <Link href={`/bookings/${renewal.id}`} className="block text-sm font-semibold text-brand underline underline-offset-2">View your renewal</Link>
      )}

      {events && events.length > 0 && (
        <section aria-labelledby="hist">
          <h2 id="hist" className={sectionTitle}>History</h2>
          <ol className="mt-3 space-y-3 border-l-2 border-line pl-5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-brand ring-4 ring-paper" />
                <span className="block font-medium">{STATUS_LABEL[e.to_status as BookingStatus]}</span>
                <span className="text-muted">{dt.format(new Date(e.created_at))}</span>
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
    <section aria-labelledby="split" className={`${card} space-y-3 p-5 text-sm tnum`}>
      <h2 id="split" className={sectionTitle}>How the payment is split at release</h2>
      <dl className="space-y-2">
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
          <h3 className="border-t border-line pt-3 font-semibold">Your payouts</h3>
          <ul className="space-y-2">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{PAYOUT_KIND[p.kind] ?? p.kind}{p.status === "awaiting_kyc" && <span className="text-brass-ink">, waiting for your KYC</span>}</span>
                <span className="font-medium">{formatNaira(p.amount_kobo)}</span>
              </li>
            ))}
          </ul>
          {payouts.some((p) => p.status === "awaiting_kyc") && (
            <Link href="/verify" className="font-semibold text-brand underline underline-offset-2">Finish identity verification to get paid</Link>
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
      <section aria-labelledby="held" className="space-y-3 rounded-3xl bg-night p-5 text-sm text-night-muted sm:p-6">
        <h2 id="held" className="flex items-center gap-2 font-display text-2xl font-extrabold text-white"><Icon name="lock" className="text-brass" />Rent paid and held</h2>
        {handoverAt ? (
          <p>
            Keys handed over {dt.format(new Date(handoverAt))}. The payment is released when the student confirms, or
            automatically {autoReleaseAt && <>on <b className="text-white">{dt.format(new Date(autoReleaseAt))}</b></>} if they don&apos;t respond.
          </p>
        ) : (
          <>
            <p>Hand over the keys, then tap below. The student confirms and the payment is released. If they don&apos;t respond within {AUTO_RELEASE_HOURS} hours, it&apos;s released automatically.</p>
            <div className="rounded-2xl bg-surface p-4 text-ink">
              <RpcButton action="handover" bookingId={bookingId} label="Keys handed over" />
            </div>
          </>
        )}
        {viewer === "caretaker" && <p>As caretaker you can mark the handover. Payouts go only to the landlord and agent.</p>}
      </section>
    );
  }
  return (
    <section aria-labelledby="held" className="space-y-3 rounded-3xl bg-night p-5 text-sm text-night-muted sm:p-6">
      <h2 id="held" className="flex items-center gap-2 font-display text-2xl font-extrabold text-white"><Icon name="lock" className="text-brass" />Payment received and held</h2>
      <p>The landlord hasn&apos;t been paid. Collect your keys, check the lodge matches the listing, then confirm.</p>
      {handoverAt && autoReleaseAt && (
        <p className="rounded-xl bg-brass px-3 py-2.5 font-medium text-night">
          Keys were marked handed over {dt.format(new Date(handoverAt))}. Confirm or raise a dispute by{" "}
          <b>{dt.format(new Date(autoReleaseAt))}</b>, or the payment is released automatically.
        </p>
      )}
      <div className="space-y-3 rounded-2xl bg-surface p-4 text-ink">
        <RpcButton action="confirm" bookingId={bookingId} label="I've moved in and it matches. Release payment" />
        <DisputeForm bookingId={bookingId} />
        <CancelForm bookingId={bookingId}
          graceNote={`Free within ${CANCEL_GRACE_HOURS} hours of paying, if you haven't received the keys. Otherwise the landlord keeps ${lateComp > 0 ? formatNaira(lateComp) : "nothing more"} (${LATE_CANCEL_PCT}% of rent${commitmentKobo > 0 ? ", less the commitment fee already paid" : ""}) and the rest is refunded.`} />
      </div>
    </section>
  );
}
