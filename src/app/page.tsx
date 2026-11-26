import Link from "next/link";
import { AGENT_FEE_CAP_PCT, formatNaira } from "@/lib/booking/money";
import { AUTO_RELEASE_HOURS, CANCEL_GRACE_HOURS, LATE_CANCEL_PCT } from "@/lib/booking/state-machine";
import { Icon } from "@/components/icons";
import { RentTrack } from "@/components/rent-track";
import { btn } from "@/components/ui";

// Example figures for the hero ticket: ₦350,000 rent with the maximum agent fee.
const EXAMPLE_RENT = 35_000_000;
const EXAMPLE_FEE = (EXAMPLE_RENT * AGENT_FEE_CAP_PCT) / 100;

const STEPS = [
  {
    title: "Pick a verified lodge",
    body: "Every landlord and agent proves their identity before listing. Student scouts visit lodges and add an inspected badge.",
  },
  {
    title: "Pay. Your rent is held",
    body: "The money sits with a licensed payment partner, not with the landlord. Cancel free within " +
      `${CANCEL_GRACE_HOURS} hours if you haven't got the keys.`,
  },
  {
    title: "Get the keys, then confirm",
    body: "If the lodge matches the listing, confirm and the landlord is paid. If it doesn't, raise a dispute and nothing moves until it's reviewed.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 pb-tabbar">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-14">
        <div>
          <p className="text-sm font-semibold text-brand">For FUTO students in Eziobodo, Umuchima and Ihiagwa</p>
          <h1 className="mt-3 font-display text-[2.75rem] font-extrabold leading-[0.95] text-ink sm:text-6xl lg:text-7xl">
            Don&apos;t pay for a lodge you haven&apos;t moved into.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            LodgeLock holds your rent until you get the keys and confirm the lodge is what was promised.
            Agent fees are capped at {AGENT_FEE_CAP_PCT}% and shown before you pay.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/lodges" className={btn.primary}>Browse lodges</Link>
            <Link href="/signup" className={btn.secondary}>Create an account</Link>
          </div>
        </div>

        <ExampleTicket />
      </section>

      <section aria-labelledby="how" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <h2 id="how" className="font-display text-3xl font-extrabold">How your rent is protected</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-4">
              <span className="font-display text-4xl font-extrabold text-brand tnum">{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl rounded-2xl bg-brand-soft px-5 py-4 text-ink">
          <b>If you don&apos;t respond:</b> once the keys are marked handed over, you have {AUTO_RELEASE_HOURS} hours to
          confirm or dispute before the rent is released automatically. Cancelling after the free window costs{" "}
          {LATE_CANCEL_PCT}% of rent, paid to the landlord as compensation; the rest comes back to you.
        </p>
      </section>

      <section aria-labelledby="listers" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 rounded-3xl bg-night p-6 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 id="listers" className="font-display text-3xl font-extrabold">Landlords and agents</h2>
            <p className="mt-3 max-w-2xl text-night-muted">
              Verify your identity once, then list your lodge. An admin approves it and it goes live. A scout visit
              later adds an inspected badge. Payouts go straight to your verified bank account when the student
              confirms move-in.
            </p>
          </div>
          <Link href="/signup" className={`${btn.primary} bg-brass text-night hover:bg-[#e2a51c]`}>List your lodge</Link>
        </div>
      </section>
    </main>
  );
}

/** The hero's one bold element: what a held booking looks like. */
function ExampleTicket() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-6 text-white shadow-[0_30px_60px_-30px_rgba(19,21,58,0.7)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Divine Grace Lodge</p>
            <p className="text-sm text-night-muted">Self-contain, Eziobodo</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brass px-3 py-1 text-xs font-bold text-night">
            <Icon name="lock" width={14} height={14} strokeWidth={2.4} />Rent held
          </span>
        </div>
        <p className="mt-8 text-sm text-night-muted">Held for you</p>
        <p className="font-display text-5xl font-extrabold tnum sm:text-6xl">{formatNaira(EXAMPLE_RENT + EXAMPLE_FEE)}</p>
        <p className="mt-1 text-sm text-night-muted">
          {formatNaira(EXAMPLE_RENT)} rent + {formatNaira(EXAMPLE_FEE)} agent fee ({AGENT_FEE_CAP_PCT}%)
        </p>
        <div aria-hidden className="relative my-7 border-t-2 border-dashed border-white/20">
          <span className="absolute -top-3 -left-9 size-6 rounded-full bg-paper" />
          <span className="absolute -top-3 -right-9 size-6 rounded-full bg-paper" />
        </div>
        <RentTrack current={1} dark />
        <p className="mt-6 text-sm text-night-muted">The landlord is paid after you collect the keys and confirm.</p>
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">Example booking. Figures are illustrative.</figcaption>
    </figure>
  );
}
