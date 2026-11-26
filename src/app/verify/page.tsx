import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { splitName } from "@/lib/kyc/schema";
import { activeKycConsents } from "./state";
import { ConsentForm, DetailsForm } from "./forms";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Verify your identity — LodgeLock" };

const d = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function VerifyPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 pt-6 pb-tabbar sm:px-6 lg:pt-10">
      <h1 className="font-display text-3xl font-semibold leading-[1.05] sm:text-4xl">Verify your identity</h1>
      <Suspense fallback={<div className="h-80 skeleton rounded-2xl" role="status" aria-label="Loading" />}>
        <VerifyStep />
      </Suspense>
    </main>
  );
}

function Notice({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "warn" }) {
  const cls = tone === "brand" ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn";
  return <div role="status" className={`space-y-2 rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

const RESULT_LABEL = (v: boolean | null) => (v === null ? "Not run" : v ? "Passed" : "Did not match");

async function VerifyStep() {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login?next=/verify");
  const uid = auth.claims.sub;

  const [{ data: profile }, { data: review }] = await Promise.all([
    supabase.from("profiles").select("full_name,role,identity_verified_at").eq("id", uid).maybeSingle(),
    supabase
      .from("kyc_reviews")
      .select("status,nin_passed,bvn_passed,bank_passed,submitted_at,decided_at,admin_note")
      .eq("subject_id", uid)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile || !["landlord", "agent"].includes(profile.role)) {
    return <Notice tone="warn"><p>Identity checks are only for landlord and agent accounts.</p></Notice>;
  }
  if (profile.identity_verified_at) {
    return (
      <Notice>
        <p className="flex items-center gap-1.5 font-semibold"><Icon name="shield" width={18} height={18} />You&apos;re verified</p>
        <p>Approved on {d.format(new Date(profile.identity_verified_at))}. Students see a verified badge on your lodges.</p>
      </Notice>
    );
  }
  if (review?.status === "pending") {
    return (
      <Notice>
        <p className="font-semibold">Thanks. Your checks are with our team.</p>
        <ul className="space-y-0.5">
          <li>NIN: {RESULT_LABEL(review.nin_passed)}</li>
          <li>BVN match: {RESULT_LABEL(review.bvn_passed)}</li>
          <li>Bank account: {RESULT_LABEL(review.bank_passed)}</li>
        </ul>
        <p>An admin will review them, usually within one working day.</p>
      </Notice>
    );
  }

  const name = splitName(profile.full_name);
  const consents = await activeKycConsents(supabase, uid);

  return (
    <>
      {review?.status === "rejected" && (
        <Notice tone="warn">
          <p className="font-semibold">Your last verification wasn&apos;t approved.</p>
          {review.admin_note && <p>Note from our team: {review.admin_note}</p>}
          <p>Check that your profile name matches your NIN and bank account exactly, then try again.</p>
        </Notice>
      )}
      {!name ? (
        <Notice tone="warn">
          <p>Your profile needs your first and last name, exactly as on your NIN, before we can verify you.</p>
          <Link href="/account" className="underline">Go to your account</Link>
        </Notice>
      ) : consents ? (
        <DetailsForm fullName={profile.full_name} />
      ) : (
        <ConsentForm />
      )}
    </>
  );
}
