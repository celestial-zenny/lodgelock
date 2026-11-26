"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/field";
import { decideLodge, type LodgeDecisionState } from "./actions";

export function LodgeDecisionForm({ lodgeId }: { lodgeId: string }) {
  const [state, action, pending] = useActionState<LodgeDecisionState, FormData>(decideLodge, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <label htmlFor={`note-${lodgeId}`} className="sr-only">Note to the lister (required to reject)</label>
      <input id={`note-${lodgeId}`} name="note" maxLength={500} placeholder="Note to lister (required to reject)"
        className={inputClass} />
      {state?.error && <p role="alert" className="text-sm text-signal">{state.error}</p>}
      <div className="flex gap-2">
        <button name="decision" value="approve" disabled={pending}
          className="min-h-11 flex-1 rounded-lg bg-brand px-3 py-2.5 font-semibold text-brand-ink disabled:opacity-50">
          Approve
        </button>
        <button name="decision" value="reject" disabled={pending}
          className="min-h-11 flex-1 rounded-lg border border-danger px-3 py-2.5 font-semibold text-danger disabled:opacity-50">
          Reject
        </button>
      </div>
    </form>
  );
}
