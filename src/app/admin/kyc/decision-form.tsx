"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/field";
import { decideKyc, type DecisionState } from "./actions";

export function DecisionForm({ reviewId, canApprove }: { reviewId: string; canApprove: boolean }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(decideKyc, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <label htmlFor={`note-${reviewId}`} className="sr-only">Note to the applicant (optional)</label>
      <input id={`note-${reviewId}`} name="note" maxLength={500} placeholder="Note to applicant (optional)" className={inputClass} />
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button name="decision" value="approve" disabled={pending || !canApprove}
          className="flex-1 rounded-lg bg-brand px-3 py-2.5 font-semibold text-brand-ink disabled:opacity-50">
          Approve
        </button>
        <button name="decision" value="reject" disabled={pending}
          className="flex-1 rounded-lg border border-danger px-3 py-2.5 font-semibold text-danger disabled:opacity-50">
          Reject
        </button>
      </div>
    </form>
  );
}
