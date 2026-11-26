"use client";

import { useActionState } from "react";
import { createBooking, type BookState } from "@/app/bookings/actions";
import { btn } from "@/components/ui";

// No client-side `min` date: computing "today" here would read the clock during prerender.
// The server action and create_booking both reject past dates.
export function BookButton({ lodgeId, renewalOf, label = "Book this lodge", layout = "inline" }: {
  lodgeId: string;
  renewalOf?: string;
  label?: string;
  /** inline: date and button side by side (sticky bar). stacked: full-width (side card, renewals). */
  layout?: "inline" | "stacked";
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(createBooking, null);
  const id = `move-in-${renewalOf ?? lodgeId}-${layout}`;
  const stacked = layout === "stacked";
  return (
    <form action={action} className={stacked ? "space-y-3" : "flex flex-col items-end gap-1"}>
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {renewalOf && <input type="hidden" name="renewalOf" value={renewalOf} />}
      <div className={stacked ? "space-y-3" : "flex items-end gap-2"}>
        <div className={stacked ? "space-y-1.5" : "flex flex-col"}>
          <label htmlFor={id} className={stacked ? "block text-sm font-semibold" : "text-xs font-medium text-muted"}>Move-in date</label>
          <input id={id} type="date" name="moveInDate" required aria-describedby={state?.error ? `${id}-error` : undefined}
            className={`rounded-xl border border-line-strong bg-surface px-3 text-ink ${stacked ? "min-h-12 w-full text-base" : "mt-0.5 min-h-12 w-[9.5rem] text-sm"}`} />
        </div>
        <button disabled={pending} className={`${btn.primary} ${stacked ? "w-full" : "px-4"}`}>
          {pending ? "Booking…" : label}
        </button>
      </div>
      {state?.error && <p id={`${id}-error`} role="alert" className={`text-sm text-signal ${stacked ? "" : "max-w-72 text-right"}`}>{state.error}</p>}
    </form>
  );
}
