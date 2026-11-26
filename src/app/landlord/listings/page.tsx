import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/booking/money";
import { lodgeChip } from "@/lib/booking/status-chip";
import { ROOM_TYPE_LABEL } from "@/lib/listing";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { LodgeVisual } from "@/components/lodge-visual";
import { Icon } from "@/components/icons";
import { btn, card, page, pageTitle } from "@/components/ui";
import { CaretakerForm, MandateForm } from "../forms";
import { ResubmitButton } from "./resubmit-button";

export const metadata: Metadata = { title: "Listings" };

export default function ListingsPage() {
  return (
    <main className={`${page} max-w-4xl`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Listings</h1>
          <p className="mt-2 max-w-xl text-muted">An admin approves each lodge before it goes live. A scout visit adds an inspected badge.</p>
        </div>
        <Link href="/landlord/listings/new" className={btn.primary}><Icon name="plus" />List a lodge</Link>
      </div>
      <div className="mt-6">
        <Suspense fallback={<ListSkeleton label="Loading listings" />}>
          <Listings />
        </Suspense>
      </div>
    </main>
  );
}

async function Listings() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/landlord/listings");
  const uid = auth.claims.sub;

  // RLS: lodges the user owns, represents or looks after; their active payee mandates.
  const [{ data: lodges }, { data: mandates }] = await Promise.all([
    supabase.from("lodges")
      .select("id,title,area,room_type,status,review_note,owner_id,agent_id,caretaker_id,landlord_commission_pct,rent_kobo,agent_fee_kobo")
      .or(`owner_id.eq.${uid},agent_id.eq.${uid},caretaker_id.eq.${uid}`)
      .order("title"),
    supabase.from("payee_mandates").select("lodge_id,agent_id").is("revoked_at", null),
  ]);

  const live = (lodges ?? []).filter((l) => l.status === "verified").map((l) => l.id);
  const { data: trust } = live.length ? await supabase.rpc("lodge_trust", { p_lodge_ids: live }) : { data: [] };
  const inspected = new Set((trust ?? []).filter((t) => t.inspected_at).map((t) => t.lodge_id));

  if (!lodges?.length) {
    return (
      <EmptyState icon="listings" title="No lodges yet"
        action={<Link href="/landlord/listings/new" className={btn.primary}>List your first lodge</Link>}>
        List a lodge with a few photos. It goes live once an admin approves it.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-4">
      {lodges.map((l) => {
        const isOwner = l.owner_id === uid;
        const mandate = mandates?.find((m) => m.lodge_id === l.id);
        const chip = lodgeChip(l.status, l.review_note);
        return (
          <li key={l.id} className={`${card} overflow-hidden`}>
            <div className="flex gap-4 p-4">
              <LodgeVisual area={l.area} roomType={l.room_type} label={false} className="hidden size-24 shrink-0 rounded-xl sm:block" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-bold leading-tight">{l.title}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip {...chip} />
                    {inspected.has(l.id) && <StatusChip label="Scout inspected" tone="done" />}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {ROOM_TYPE_LABEL[l.room_type]} in {l.area}. {isOwner ? "You own it" : l.agent_id === uid ? "You're the agent" : "You're the caretaker"}.
                </p>
                <p className="mt-1 font-display text-xl font-semibold tnum">{formatNaira(l.rent_kobo)} <span className="font-sans text-sm font-normal text-muted">a year</span></p>
                {l.status === "pending_review" && <p className="mt-2 text-sm text-muted">An admin is checking this listing. It goes live when approved.</p>}
                {l.status === "verified" && (
                  <Link href={`/lodges/${l.id}`} className="mt-2 inline-block text-sm font-semibold text-brand underline underline-offset-2">See what students see</Link>
                )}
                {l.status === "draft" && (
                  <div className="mt-3 space-y-2">
                    {l.review_note && <p className="rounded-xl bg-signal-soft px-3 py-2 text-sm text-signal"><b>From the admin:</b> {l.review_note}</p>}
                    {l.caretaker_id !== uid && <ResubmitButton lodgeId={l.id} />}
                  </div>
                )}
              </div>
            </div>
            {(l.agent_id || isOwner) && (
              <div className="space-y-4 border-t border-line bg-paper/60 p-4">
                {l.agent_id && (
                  <p className="text-sm">
                    The agent earns the {formatNaira(l.agent_fee_kobo)} student-paid fee plus a <b>{l.landlord_commission_pct}%</b> commission
                    from the landlord&apos;s rent ({formatNaira(Math.floor((l.rent_kobo * l.landlord_commission_pct) / 100))}).
                    Renewals through LodgeLock earn 2.5% instead.
                  </p>
                )}
                {isOwner && <CaretakerForm lodgeId={l.id} current={l.caretaker_id ? "assigned" : null} />}
                {isOwner && l.agent_id && (
                  <MandateForm lodgeId={l.id} agentId={l.agent_id} agentName="your agent" active={!!mandate} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
