"use client";

import { useActionState } from "react";
import { createBooking, type BookState } from "@/app/bookings/actions";

// No client-side `min` date: computing "today" here would read the clock during prerender.
// The server action and create_booking both reject past dates.
export function BookButton({ lodgeId, renewalOf, label = "Book this lodge" }: {
  lodgeId: string;
  renewalOf?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(createBooking, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {renewalOf && <input type="hidden" name="renewalOf" value={renewalOf} />}
      <div className="flex items-end gap-2">
        <label className="flex flex-col text-xs text-muted">
          Move-in date
          <input type="date" name="moveInDate" required
            className="mt-0.5 rounded-lg border border-line bg-surface px-2 py-2.5 text-sm text-foreground" />
        </label>
        <button disabled={pending} className="rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
          {pending ? "Booking…" : label}
        </button>
      </div>
      {state?.error && <p role="alert" className="max-w-64 text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}
