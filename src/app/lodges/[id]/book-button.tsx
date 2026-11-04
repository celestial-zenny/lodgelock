"use client";

import { useActionState } from "react";
import { createBooking, type BookState } from "@/app/bookings/actions";

export function BookButton({ lodgeId }: { lodgeId: string }) {
  const [state, action, pending] = useActionState<BookState, FormData>(createBooking, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <button disabled={pending} className="rounded-lg bg-brand px-5 py-3 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Booking…" : "Book this lodge"}
      </button>
      {state?.error && <p role="alert" className="max-w-56 text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}
