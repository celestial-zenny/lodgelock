import type { Metadata } from "next";
import Link from "next/link";
import { POLICY_VERSION } from "@/lib/auth/signup-schema";
import { AGENT_FEE_CAP_PCT } from "@/lib/booking/money";

export const metadata: Metadata = { title: "Privacy Policy and Terms" };

// Prototype policy. Must be reviewed before launch. Source of truth for processing activities:
// docs/data-processing.md
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pt-6 pb-tabbar text-sm leading-relaxed sm:px-6 lg:pt-10">
      <header>
        <h1 className="font-display text-3xl font-semibold leading-[1.05] sm:text-4xl">Privacy Policy</h1>
        <p className="text-muted">Version {POLICY_VERSION}. Prototype, not yet reviewed by counsel.</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">What we collect and why</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Account details</b> (name, email, optional phone) to run your account. Lawful basis: contract.</li>
          <li><b>Your age.</b> We ask for your date of birth only to check whether you&apos;re 18 or over. We store the yes/no result, not the date.</li>
          <li><b>Parent or guardian details</b>, if you&apos;re under 18, so they can consent and we can confirm with them. Lawful basis: their consent.</li>
          <li><b>Bookings and payments</b> to hold and release rent. We keep transaction records as the law requires.</li>
          <li><b>Identity checks</b> (NIN, BVN match, bank account), for landlords and agents only. We ask for explicit consent first, and we keep only the pass/fail result. We never store your NIN or BVN.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">What we don&apos;t do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No analytics or session recording unless you opt in.</li>
          <li>No marketing messages without your consent. Every message says who sent it and has a working unsubscribe link.</li>
          <li>We don&apos;t sell your data.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Who processes your data</h2>
        <p>Supabase (database and storage), Vercel (hosting) and Interswitch (payments and identity checks).</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Your rights</h2>
        <p>
          Under the Nigeria Data Protection Act 2023 you can ask to see, correct or delete your data, and you
          can withdraw consent at any time. Request deletion from your <Link href="/account" className="underline">account page</Link>.
          We keep financial records for as long as the law requires, anonymised where possible.
        </p>
      </section>

      <section id="terms" className="space-y-2 border-t border-line pt-6">
        <h2 className="font-display text-xl font-semibold">Terms (summary)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>LodgeLock is a booking platform. We never hold your money ourselves. A licensed payment partner holds it.</li>
          <li>Rent is released when you confirm you&apos;ve moved in. If the landlord, agent or caretaker marks the keys handed over and you don&apos;t confirm or dispute within 48 hours, it&apos;s released automatically.</li>
          <li>If the lodge doesn&apos;t match the listing, raise a dispute instead of confirming (within 48 hours of the handover). Disputed payments are held until we resolve them.</li>
          <li>You can cancel while your rent is held. It&apos;s free within 24 hours of paying if you haven&apos;t received the keys. After that, or if you don&apos;t move in within 7 days of your move-in date and no handover happened, the landlord receives 10% of rent and the rest is refunded.</li>
          <li>Some landlords charge a commitment fee (10–20% of rent). If so, it&apos;s shown before you pay, goes to the landlord when you pay, isn&apos;t held, and counts towards the 10% above.</li>
          <li>Agent fees paid by students can&apos;t exceed {AGENT_FEE_CAP_PCT}% of annual rent. Agents may also receive a commission from the landlord, which never comes out of your payment.</li>
          <li>Payouts go only to identity-verified landlords and agents. Caretakers never receive money through LodgeLock.</li>
        </ul>
      </section>
    </main>
  );
}
