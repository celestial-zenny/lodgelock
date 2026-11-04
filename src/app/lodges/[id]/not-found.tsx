import Link from "next/link";

export default function LodgeNotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Lodge not found</h1>
      <p className="mt-2 text-muted">It may have been taken down or is waiting for re-verification.</p>
      <Link href="/lodges" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-ink">
        Browse verified lodges
      </Link>
    </main>
  );
}
