"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/field";
import { confirmHandover, raiseDispute, type DisputeState, type HandoverState } from "../actions";

export function HandoverButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [state, action, pending] = useActionState<HandoverState, FormData>(confirmHandover, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Saving…" : label}
      </button>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function DisputeForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DisputeState, FormData>(raiseDispute, null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-danger px-4 py-3 text-sm font-semibold text-danger">
        Something&apos;s wrong: raise a dispute
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-danger/30 p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="reason" className="block text-sm font-medium">What doesn&apos;t match the listing?</label>
      <textarea id="reason" name="reason" rows={4} minLength={10} maxLength={2000} required className={inputClass} />
      <p className="text-xs text-muted">Your rent stays held while we review. Don&apos;t confirm the handover if you raise a dispute.</p>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-danger px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "Submitting…" : "Submit dispute"}
      </button>
    </form>
  );
}
