"use client";

import { useActionState, useState } from "react";
import { inputClass } from "@/components/field";
import {
  cancelBooking, confirmMoveIn, markHandover, raiseDispute, type ActionState, type DisputeState,
} from "../actions";

const ACTIONS = { confirm: confirmMoveIn, handover: markHandover } as const;

export function RpcButton({ bookingId, label, action: which }: {
  bookingId: string;
  label: string;
  action: keyof typeof ACTIONS;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(ACTIONS[which], null);
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
        It doesn&apos;t match the listing: raise a dispute
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-danger/30 bg-surface p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="reason" className="block text-sm font-medium">What doesn&apos;t match the listing?</label>
      <textarea id="reason" name="reason" rows={4} minLength={10} maxLength={2000} required className={inputClass} />
      <p className="text-xs text-muted">Your money stays held while we review. Nothing is released automatically during a dispute.</p>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-danger px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "Submitting…" : "Submit dispute"}
      </button>
    </form>
  );
}

export function CancelForm({ bookingId, graceNote }: { bookingId: string; graceNote: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelBooking, null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-center text-sm text-muted underline">
        Cancel this booking
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm">{graceNote}</p>
      <p className="text-xs text-muted">If the lodge doesn&apos;t match the listing, raise a dispute instead: that&apos;s a full review, not a cancellation.</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5" />
        <span>I want to cancel this booking.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg border border-danger px-4 py-3 font-semibold text-danger disabled:opacity-60">
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
    </form>
  );
}
