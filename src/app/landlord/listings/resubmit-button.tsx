"use client";

import { useTransition, useState } from "react";
import { submitLodge } from "@/app/landlord/lodges/actions";
import { useToast } from "@/components/toast";
import { btn } from "@/components/ui";

export function ResubmitButton({ lodgeId }: { lodgeId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  return (
    <div className="space-y-1.5">
      <button disabled={pending} className={`${btn.small} bg-brand text-brand-ink hover:bg-brand-hover`}
        onClick={() => start(async () => {
          const res = await submitLodge(lodgeId);
          setError(res.error ?? null);
          if (!res.error) toast("Sent for review. An admin approves it before it goes live.");
        })}>
        {pending ? "Sending…" : "Resubmit for review"}
      </button>
      {error && <p role="alert" className="text-sm text-signal">{error}</p>}
    </div>
  );
}
