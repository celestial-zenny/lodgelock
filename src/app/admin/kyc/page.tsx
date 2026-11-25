import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { DecisionForm } from "./decision-form";
import { dbFailure } from "@/lib/db-error";

export const metadata: Metadata = { title: "KYC approvals — LodgeLock admin" };

const dt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
});

export default function AdminKycPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Identity approvals</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <Queue />
      </Suspense>
    </main>
  );
}

function Result({ label, value }: { label: string; value: boolean | null }) {
  const [text, cls] =
    value === null ? ["not run", "text-muted"] : value ? ["pass", "text-brand"] : ["fail", "text-danger"];
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-medium ${cls}`}>{text}</dd>
    </div>
  );
}

async function Queue() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/admin/kyc");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.claims.sub).maybeSingle();
  if (me?.role !== "admin") notFound();

  // RLS: admins can read every review and profile. Only results are stored; there are no identifiers to show.
  const { data: reviews, error } = await supabase
    .from("kyc_reviews")
    .select("id,nin_passed,bvn_passed,bank_passed,all_passed,submitted_at,subject:profiles!kyc_reviews_subject_id_fkey(full_name,role)")
    .eq("status", "pending")
    .order("submitted_at");
  if (error) dbFailure("Loading the KYC approval queue", error);
  if (error) return <p role="alert" className="text-danger">Couldn&apos;t load the queue.</p>;
  if (!reviews?.length) return <p className="text-muted">Nothing waiting for review.</p>;

  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">{r.subject?.full_name}</p>
            <p className="text-xs capitalize text-muted">{r.subject?.role} · {dt.format(new Date(r.submitted_at))}</p>
          </div>
          <dl className="space-y-1 text-sm">
            <Result label="NIN" value={r.nin_passed} />
            <Result label="BVN Boolean Match" value={r.bvn_passed} />
            <Result label="Bank account" value={r.bank_passed} />
          </dl>
          <DecisionForm reviewId={r.id} canApprove={!!r.all_passed} />
        </li>
      ))}
    </ul>
  );
}
