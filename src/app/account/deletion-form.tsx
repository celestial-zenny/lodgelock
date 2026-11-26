"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/field";
import { btn } from "@/components/ui";
import { requestDeletion, type DeletionState } from "./actions";

export function DeletionForm() {
  const [state, action, pending] = useActionState<DeletionState, FormData>(requestDeletion, null);
  if (state?.done) {
    return (
      <p role="status" className="rounded-xl bg-leaf-soft px-3 py-2.5 text-sm font-medium text-leaf">
        Request received. We&apos;ll process it and email you when it&apos;s done.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="reason" className="block text-sm font-semibold">Reason (optional)</label>
      <textarea id="reason" name="reason" rows={3} maxLength={1000} className={inputClass} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 accent-[var(--danger)]" />
        <span>I understand my account will be closed and my personal data deleted, except records the law requires us to keep.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-signal">{state.error}</p>}
      <button disabled={pending} className={`${btn.danger} w-full`}>
        {pending ? "Submitting…" : "Request data deletion"}
      </button>
    </form>
  );
}
