// Mirrors public.booking_transitions in supabase/migrations/0001_init.sql.
// The DATABASE is the enforcer; this copy exists for UI (which buttons to show) and early errors.

export const BOOKING_STATUSES = [
  "DRAFT",
  "PAID_HELD",
  "MOVE_IN_CONFIRMED",
  "DISPUTED",
  "AUTO_CONFIRMED",
  "REFUNDED",
  "PAID_OUT",
  "CANCELLED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ["PAID_HELD", "CANCELLED"],
  PAID_HELD: ["MOVE_IN_CONFIRMED", "DISPUTED", "AUTO_CONFIRMED"],
  MOVE_IN_CONFIRMED: ["PAID_OUT"],
  AUTO_CONFIRMED: ["PAID_OUT"],
  DISPUTED: ["REFUNDED", "PAID_OUT"],
  REFUNDED: [],
  PAID_OUT: [],
  CANCELLED: [],
};

/**
 * Release rule: payout is booked the moment BOTH the student and the landlord/agent confirm "keys handed over"
 * (PAID_HELD -> MOVE_IN_CONFIRMED). Fallback only: if the landlord confirmed and the student neither confirms nor
 * disputes within this many hours of the landlord's confirmation, the booking is AUTO_CONFIRMED.
 * Enforced in public.confirm_keys_handover / private.auto_confirm_expired (0005).
 */
export const MOVE_IN_WINDOW_HOURS = 72;

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Student-facing copy for each state. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: "Not paid yet",
  PAID_HELD: "Paid — rent held until keys are handed over",
  MOVE_IN_CONFIRMED: "Keys handed over — landlord payout released",
  DISPUTED: "Dispute under review",
  AUTO_CONFIRMED: "Auto-confirmed (no student response within 72h of handover)",
  REFUNDED: "Refunded",
  PAID_OUT: "Landlord paid",
  CANCELLED: "Cancelled",
};
