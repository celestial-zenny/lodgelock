import type { Metadata } from "next";
import { POLICY_VERSION } from "@/lib/auth/signup-schema";

export const metadata: Metadata = { title: "Privacy Policy & Terms — LodgeLock" };

// Prototype policy. Must be reviewed before launch. Source of truth for processing activities:
// docs/data-processing.md
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 text-sm leading-relaxed">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-muted">Version {POLICY_VERSION} · Prototype, not yet reviewed by counsel</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What we collect and why</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Account details</b> (name, email, optional phone) to run your account. Lawful basis: contract.</li>
          <li><b>Your age.</b> We ask for your date of birth only to check whether you&apos;re 18 or over. We store the yes/no result, not the date.</li>
          <li><b>Parent or guardian details</b>, if you&apos;re under 18, so they can consent and we can confirm with them. Lawful basis: their consent.</li>
          <li><b>Bookings and payments</b> to hold and release rent. We keep transaction records as the law requires.</li>
          <li><b>Identity checks</b> (NIN, BVN match, bank account), for landlords and agents only. We ask for explicit consent first, and we keep only the pass/fail result. We never store your NIN or BVN.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What we don&apos;t do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No analytics or session recording unless you opt in.</li>
          <li>No marketing messages without your consent. Every message says who sent it and has a working unsubscribe link.</li>
          <li>We don&apos;t sell your data.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Who processes your data</h2>
        <p>Supabase (database and storage), Vercel (hosting) and Interswitch (payments and identity checks).</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your rights</h2>
        <p>
          Under the Nigeria Data Protection Act 2023 you can ask to see, correct or delete your data, and you
          can withdraw consent at any time. You&apos;ll be able to make a deletion request from your account page.
          We keep financial records for as long as the law requires, anonymised where possible.
        </p>
      </section>

      <section id="terms" className="space-y-2 border-t border-line pt-6">
        <h2 className="text-base font-semibold">Terms (summary)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>LodgeLock is a booking platform. We never hold your money ourselves. A licensed payment partner holds it.</li>
          <li>Rent is released to the landlord when you confirm move-in, or automatically if you don&apos;t respond within 72 hours of payment.</li>
          <li>If the lodge doesn&apos;t match the listing, raise a dispute within 72 hours. Disputed payments are held until we resolve them.</li>
          <li>Agent fees can&apos;t exceed 5% of annual rent.</li>
        </ul>
      </section>
    </main>
  );
}
