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
  PAID_HELD: "Paid — rent held until you move in",
  MOVE_IN_CONFIRMED: "Move-in confirmed",
  DISPUTED: "Dispute under review",
  AUTO_CONFIRMED: "Auto-confirmed (no response in 72h)",
  REFUNDED: "Refunded",
  PAID_OUT: "Landlord paid",
  CANCELLED: "Cancelled",
};
