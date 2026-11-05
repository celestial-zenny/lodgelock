import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/booking/money";
import { CaretakerForm, MandateForm } from "./forms";

export const metadata: Metadata = { title: "My lodges & payouts — LodgeLock" };

const d = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

const KIND: Record<string, string> = {
  rent: "Rent", agent_fee: "Agent fee", landlord_commission: "Commission", renewal_bonus: "Renewal bonus",
  commitment_fee: "Commitment fee", late_cancel_compensation: "Late-cancellation compensation", refund: "Refund",
};

export default function LandlordPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">My lodges &amp; payouts</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/landlord");
  const uid = auth.claims.sub;

  const { data: me } = await supabase.from("profiles").select("role,identity_verified_at").eq("id", uid).maybeSingle();
  if (!me || !["landlord", "agent", "caretaker"].includes(me.role)) {
    return <p className="text-muted">This page is for landlords, agents and caretakers.</p>;
  }

  // RLS: lodges the user owns, represents or looks after; their own payouts and mandates.
  const [{ data: lodges }, { data: payouts }, { data: mandates }] = await Promise.all([
    supabase.from("lodges")
      .select("id,title,area,status,owner_id,agent_id,caretaker_id,landlord_commission_pct,commitment_fee_pct,rent_kobo,agent_fee_kobo")
      .or(`owner_id.eq.${uid},agent_id.eq.${uid},caretaker_id.eq.${uid}`)
      .order("title"),
    me.role === "caretaker"
      ? Promise.resolve({ data: [] as { id: string; kind: string; amount_kobo: number; status: string; created_at: string; booking_id: string }[] })
      : supabase.from("payout_instructions").select("id,kind,amount_kobo,status,created_at,booking_id")
          .eq("payee_id", uid).order("created_at", { ascending: false }).limit(50),
    supabase.from("payee_mandates").select("lodge_id,agent_id").is("revoked_at", null),
  ]);

  return (
    <>
      {me.role !== "caretaker" && !me.identity_verified_at && (
        <p className="rounded-xl bg-warn-soft p-4 text-sm text-warn">
          Payouts are held until you verify your identity. <Link href="/verify" className="underline">Verify now</Link>
        </p>
      )}

      {me.role !== "caretaker" && (
        <section aria-labelledby="payouts" className="space-y-2">
          <h2 id="payouts" className="font-semibold">Payouts</h2>
          {payouts && payouts.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <Link href={`/bookings/${p.booking_id}`} className="font-medium underline">{KIND[p.kind] ?? p.kind}</Link>
                    <p className="text-xs text-muted">
                      {d.format(new Date(p.created_at))} · {p.status === "awaiting_kyc" ? "waiting for your KYC" : p.status}
                    </p>
                  </div>
                  <span className="font-semibold">{formatNaira(p.amount_kobo)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No payouts yet.</p>
          )}
        </section>
      )}

      <section aria-labelledby="lodges" className="space-y-3">
        <h2 id="lodges" className="font-semibold">Lodges</h2>
        {!lodges?.length && <p className="text-sm text-muted">No lodges linked to your account yet.</p>}
        {lodges?.map((l) => {
          const isOwner = l.owner_id === uid;
          const mandate = mandates?.find((m) => m.lodge_id === l.id);
          return (
            <article key={l.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-sm text-muted">
                  {l.area} · {formatNaira(l.rent_kobo)}/year · {isOwner ? "You own it" : l.agent_id === uid ? "You're the agent" : "You're the caretaker"}
                </p>
              </div>
              {l.agent_id && (
                <p className="text-sm">
                  Agent earns the {formatNaira(l.agent_fee_kobo)} student-paid fee plus a <b>{l.landlord_commission_pct}%</b> commission
                  from the landlord&apos;s rent ({formatNaira(Math.floor((l.rent_kobo * l.landlord_commission_pct) / 100))}).
                  Renewals through LodgeLock: 2.5% instead.
                </p>
              )}
              {isOwner && <CaretakerForm lodgeId={l.id} current={l.caretaker_id ? "assigned" : null} />}
              {isOwner && l.agent_id && (
                <MandateForm lodgeId={l.id} agentId={l.agent_id} agentName="your agent" active={!!mandate} />
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
