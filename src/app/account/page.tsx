import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { ListSkeleton } from "@/components/skeleton";
import { Icon, type IconName } from "@/components/icons";
import { btn, card, page, pageTitle, sectionTitle } from "@/components/ui";
import { DeletionForm } from "./deletion-form";

export const metadata: Metadata = { title: "Account" };

function RowLink({ href, icon, children }: { href: string; icon: IconName; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 font-semibold hover:bg-brand-soft hover:text-brand">
        <Icon name={icon} className="text-brand" />{children}
      </Link>
    </li>
  );
}

const d = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function AccountPage() {
  return (
    <main className={`${page} max-w-xl space-y-6`}>
      <h1 className={pageTitle}>Your account</h1>
      <Suspense fallback={<ListSkeleton rows={2} label="Loading account" />}>
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
      <dl className={`${card} space-y-3 p-5 text-sm`}>
        <div className="flex justify-between gap-4"><dt className="text-muted">Name</dt><dd>{profile?.full_name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="truncate">{String(auth.claims.email ?? "")}</dd></div>
        {profile?.phone && <div className="flex justify-between gap-4"><dt className="text-muted">Phone</dt><dd>{profile.phone}</dd></div>}
        <div className="flex justify-between gap-4"><dt className="text-muted">Account type</dt><dd className="capitalize">{profile?.role}</dd></div>
        {profile && <div className="flex justify-between gap-4"><dt className="text-muted">Member since</dt><dd>{d.format(new Date(profile.created_at))}</dd></div>}
      </dl>

      <ul className={`${card} divide-y divide-line overflow-hidden`}>
        {(profile?.role === "landlord" || profile?.role === "agent") && <RowLink href="/verify" icon="shield">Verify my identity</RowLink>}
        {(profile?.role === "landlord" || profile?.role === "agent" || profile?.role === "caretaker") && (
          <RowLink href="/landlord" icon="dashboard">My lodges and payouts</RowLink>
        )}
        {profile?.role === "admin" && <RowLink href="/admin/kyc" icon="shield">Identity approvals</RowLink>}
        {profile?.role === "admin" && <RowLink href="/admin/lodges" icon="lodges">Lodge approvals</RowLink>}
        <RowLink href="/bookings" icon="bookings">My bookings</RowLink>
        <RowLink href="/privacy" icon="info">Privacy and terms</RowLink>
      </ul>

      <form action={signOut}>
        <button className={`${btn.secondary} w-full`}><Icon name="logout" />Log out</button>
      </form>

      <section aria-labelledby="del" className="space-y-3 rounded-2xl border border-signal/30 bg-surface p-5">
        <h2 id="del" className={sectionTitle}>Delete my data</h2>
        <p className="text-sm text-muted">
          Under the Nigeria Data Protection Act you can ask us to delete your personal data. We keep payment and
          booking records for as long as the law requires, with your name removed where possible.
          If you have a booking with money held, we&apos;ll settle it first.{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
        </p>
        {pending ? (
          <p role="status" className="rounded-xl bg-brass-soft px-3 py-2.5 text-sm text-brass-ink">
            Deletion requested on {d.format(new Date(pending.requested_at))}. It&apos;s being processed.
          </p>
        ) : (
          <DeletionForm />
        )}
      </section>
    </>
  );
}
