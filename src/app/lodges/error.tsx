"use client";

export default function LodgesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t load lodges</h1>
      <p className="mt-2 text-muted">Check your connection and try again.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-ink">
        Try again
      </button>
    </main>
  );
}
