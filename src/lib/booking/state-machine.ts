// Mirrors public.booking_transitions (supabase/migrations/0001_init.sql, extended in 0007).
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
  "STUDENT_CANCELLED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ["PAID_HELD", "CANCELLED"],
  PAID_HELD: ["MOVE_IN_CONFIRMED", "DISPUTED", "AUTO_CONFIRMED", "STUDENT_CANCELLED"],
  MOVE_IN_CONFIRMED: ["PAID_OUT"],
  AUTO_CONFIRMED: ["PAID_OUT"],
  DISPUTED: ["REFUNDED", "PAID_OUT"],
  REFUNDED: [],
  PAID_OUT: [],
  CANCELLED: [],
  STUDENT_CANCELLED: [],
};

/**
 * Release rule (0007; enforced in public.confirm_move_in, public.mark_handover, private.process_deadlines):
 * - The student confirming move-in releases the payout immediately (PAID_HELD -> MOVE_IN_CONFIRMED).
 * - The landlord/agent/caretaker marks "keys handed over"; if the student neither confirms nor disputes within
 *   AUTO_RELEASE_HOURS of that, the payout is auto-released (PAID_HELD -> AUTO_CONFIRMED). The clock starts at handover.
 * - No handover and no student confirmation by move-in date + NO_SHOW_DAYS -> STUDENT_CANCELLED (no-show).
 * - The student may cancel while the money is held: free within CANCEL_GRACE_HOURS of payment if there was no
 *   handover; otherwise the landlord gets LATE_CANCEL_PCT of rent (less any commitment fee already paid).
 */
export const AUTO_RELEASE_HOURS = 48;
export const NO_SHOW_DAYS = 7;
export const CANCEL_GRACE_HOURS = 24;
export const LATE_CANCEL_PCT = 10;

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Student-facing copy for each state. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: "Not paid yet",
  PAID_HELD: "Paid — rent held until you confirm move-in",
  MOVE_IN_CONFIRMED: "Move-in confirmed — payout released",
  DISPUTED: "Dispute under review",
  AUTO_CONFIRMED: "Auto-released (no student response within 48h of handover)",
  REFUNDED: "Refunded",
  PAID_OUT: "Landlord paid",
  CANCELLED: "Cancelled",
  STUDENT_CANCELLED: "Cancelled by student — refund issued",
};
