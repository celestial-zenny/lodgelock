import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-12 pb-tabbar sm:px-6 text-center">
      <div aria-hidden className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-brand-soft text-2xl">
        ✉
      </div>
      <h1 className="font-display text-3xl font-extrabold leading-[1.05] sm:text-4xl">Check your email</h1>
      <p className="mt-2 text-muted">
        If that address can be used for a new account, we&apos;ve sent you a link to confirm it.
        Open it on this phone to finish signing up.
      </p>
      <p className="mt-6 text-sm text-muted">
        Nothing yet? Check your spam folder, or <Link href="/signup" className="text-brand underline">try again</Link>.
      </p>
    </main>
  );
}
