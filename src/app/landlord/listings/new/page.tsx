import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { PanelSkeleton } from "@/components/skeleton";
import { Icon } from "@/components/icons";
import { btn, page, pageTitle } from "@/components/ui";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = { title: "List a lodge" };

export default function NewListingPage() {
  return (
    <main className={`${page} max-w-2xl`}>
      <Link href="/landlord/listings" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <Icon name="arrow-left" width={16} height={16} />Listings
      </Link>
      <h1 className={`${pageTitle} mt-1`}>List a lodge</h1>
      <p className="mt-2 text-muted">It goes to an admin for review, then live. Add photos after the details.</p>
      <div className="mt-6">
        <Suspense fallback={<PanelSkeleton label="Loading form" />}>
          <Gate />
        </Suspense>
      </div>
    </main>
  );
}

async function Gate() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/landlord/listings/new");
  const { data: me } = await supabase.from("profiles").select("role,identity_verified_at").eq("id", auth.claims.sub).maybeSingle();
  if (!me || (me.role !== "landlord" && me.role !== "agent")) {
    return <EmptyState icon="listings" title="Only landlords and agents can list lodges" />;
  }
  if (!me.identity_verified_at) {
    return (
      <EmptyState icon="shield" title="Verify your identity first" action={<Link href="/verify" className={btn.primary}>Verify my identity</Link>}>
        Students only see lodges from ID-verified landlords and agents. It takes a few minutes, then an admin approves it.
      </EmptyState>
    );
  }
  return <ListingForm role={me.role} />;
}
