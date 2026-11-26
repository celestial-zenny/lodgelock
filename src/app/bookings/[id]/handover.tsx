"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/field";
import { useToast, useToastOnChange } from "@/components/toast";
import { btn } from "@/components/ui";
import { AUTO_RELEASE_HOURS } from "@/lib/booking/state-machine";
import {
  cancelBooking, confirmMoveIn, markHandover, raiseDispute, type ActionState, type DisputeState,
} from "../actions";

const ACTIONS = { confirm: confirmMoveIn, handover: markHandover } as const;
const DONE: Record<keyof typeof ACTIONS, string> = {
  confirm: "Move-in confirmed. Rent released to the landlord.",
  handover: `Keys marked handed over. The student has ${AUTO_RELEASE_HOURS} hours to confirm or dispute.`,
};

export function RpcButton({ bookingId, label, action: which }: {
  bookingId: string;
  label: string;
  action: keyof typeof ACTIONS;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(ACTIONS[which], null);
  useToastOnChange(state?.done ? DONE[which] : null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <button disabled={pending} className={`${btn.primary} w-full`}>
        {pending ? "Saving…" : label}
      </button>
      {state?.error && <p role="alert" className="text-sm text-signal">{state.error}</p>}
    </form>
  );
}

export function DisputeForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DisputeState, FormData>(raiseDispute, null);
  const toast = useToast();
  const wasPending = useRef(false);
  // raiseDispute returns null on success: toast when a submission finishes without an error.
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) toast("Dispute raised. Your rent stays held while we review it.");
    wasPending.current = pending;
  }, [pending, state, toast]);

  if (!open) {
    return (
      <div className="space-y-1.5">
        <button onClick={() => setOpen(true)} className={`${btn.danger} w-full`}>Raise a dispute</button>
        <p className="text-center text-xs text-muted">If the lodge doesn&apos;t match the listing. Your rent stays held while we review.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-signal/40 bg-signal-soft/40 p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="reason" className="block text-sm font-semibold">What doesn&apos;t match the listing?</label>
      <textarea id="reason" name="reason" rows={4} minLength={10} maxLength={2000} required className={inputClass}
        aria-describedby="reason-help" />
      <p id="reason-help" className="text-xs text-muted">Your rent stays held while we review. Nothing is released automatically during a dispute.</p>
      {state?.error && <p role="alert" className="text-sm text-signal">{state.error}</p>}
      <button disabled={pending} className={`${btn.dangerSolid} w-full`}>
        {pending ? "Submitting…" : "Submit dispute"}
      </button>
    </form>
  );
}

export function CancelForm({ bookingId, graceNote }: { bookingId: string; graceNote: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelBooking, null);
  useToastOnChange(state?.done ? "Booking cancelled. Your refund has been recorded." : null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-11 w-full text-center text-sm font-medium text-muted underline underline-offset-2">
        Cancel this booking
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-paper p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm">{graceNote}</p>
      <p className="text-xs text-muted">If the lodge doesn&apos;t match the listing, raise a dispute instead: that&apos;s a full review, not a cancellation.</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 accent-[var(--signal)]" />
        <span>I want to cancel this booking.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-signal">{state.error}</p>}
      <button disabled={pending} className={`${btn.danger} w-full`}>
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
    </form>
  );
}
