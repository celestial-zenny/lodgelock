import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { btn, page } from "@/components/ui";

export default function LodgeNotFound() {
  return (
    <main className={`${page} max-w-lg`}>
      <EmptyState icon="lodges" title="Lodge not found" action={<Link href="/lodges" className={btn.primary}>Browse verified lodges</Link>}>
        It may have been taken down, or it&apos;s back in review after an edit.
      </EmptyState>
    </main>
  );
}
