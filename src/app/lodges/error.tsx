"use client";

import { EmptyState } from "@/components/empty-state";
import { btn, page } from "@/components/ui";

export default function LodgesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={`${page} max-w-lg`}>
      <EmptyState icon="alert" title="Lodges didn't load" action={<button onClick={reset} className={btn.primary}>Try again</button>}>
        Check your connection, then try again.
      </EmptyState>
    </main>
  );
}
