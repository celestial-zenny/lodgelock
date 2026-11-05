import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { DeletionForm } from "./deletion-form";

export const metadata: Metadata = { title: "Account — LodgeLock" };

const d = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/account");

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("full_name,role,phone,is_adult,created_at").eq("id", auth.claims.sub).maybeSingle(),
    supabase.from("data_deletion_requests").select("id,status,requested_at").order("requested_at", { ascending: false }),
  ]);
  const pending = requests?.find((r) => r.status === "pending");

  return (
    <>
      <dl className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted">Name</dt><dd>{profile?.full_name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="truncate">{String(auth.claims.email ?? "")}</dd></div>
        {profile?.phone && <div className="flex justify-between gap-4"><dt className="text-muted">Phone</dt><dd>{profile.phone}</dd></div>}
        <div className="flex justify-between gap-4"><dt className="text-muted">Account type</dt><dd className="capitalize">{profile?.role}</dd></div>
        {profile && <div className="flex justify-between gap-4"><dt className="text-muted">Member since</dt><dd>{d.format(new Date(profile.created_at))}</dd></div>}
      </dl>

      {(profile?.role === "landlord" || profile?.role === "agent") && (
        <Link href="/verify" className="block rounded-xl border border-line bg-surface p-4 font-medium">Verify my identity →</Link>
      )}
      {profile?.role === "admin" && (
        <Link href="/admin/kyc" className="block rounded-xl border border-line bg-surface p-4 font-medium">Identity approvals →</Link>
      )}
      <Link href="/bookings" className="block rounded-xl border border-line bg-surface p-4 font-medium">My bookings →</Link>

      <section aria-labelledby="del" className="space-y-3 rounded-xl border border-danger/30 p-4">
        <h2 id="del" className="font-semibold">Delete my data</h2>
        <p className="text-sm text-muted">
          Under the Nigeria Data Protection Act you can ask us to delete your personal data. We keep payment and
          booking records for as long as the law requires, with your name removed where possible.
          If you have a booking with money held, we&apos;ll settle it first.{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
        {pending ? (
          <p role="status" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            Deletion requested on {d.format(new Date(pending.requested_at))}. It&apos;s being processed.
          </p>
        ) : (
          <DeletionForm />
        )}
      </section>
    </>
  );
}
