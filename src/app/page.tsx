import Link from "next/link";

const STEPS = [
  { title: "Browse verified lodges", body: "Every landlord and agent proves their identity. Student scouts inspect lodges in person." },
  { title: "Pay. Your rent is held", body: "The money sits with a licensed payment partner, not with the landlord, until the keys are handed over." },
  { title: "Get the keys, both confirm", body: "If the lodge matches the listing, you and the landlord both tap Keys handed over and the landlord is paid the same day. If not, raise a dispute." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-4 pt-10 pb-8">
        <p className="text-sm font-medium text-brand">For FUTO students · Eziobodo · Umuchima · Ihiagwa</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Don&apos;t pay for a lodge you haven&apos;t moved into.
        </h1>
        <p className="mt-3 text-lg text-muted">
          LodgeLock holds your rent until you get the keys and confirm the lodge is what was promised.
          Agent fees are capped at 5% and shown upfront.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/lodges" className="rounded-lg bg-brand px-5 py-3 text-center font-semibold text-brand-ink">
            Browse lodges
          </Link>
          <Link href="/signup" className="rounded-lg border border-line bg-surface px-5 py-3 text-center font-semibold">
            Create an account
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-surface p-4">
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span>
              <h2 className="mt-3 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
