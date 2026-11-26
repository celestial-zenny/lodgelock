// The four money states a person cares about, derived from the booking status (display only; the DB is the enforcer).
import type { BookingStatus } from "./state-machine";

export type ChipTone = "pending" | "held" | "handover" | "done" | "alert" | "neutral";
export type StatusChip = { label: string; tone: ChipTone };

export function bookingChip(status: BookingStatus, handoverAt: string | null): StatusChip {
  switch (status) {
    case "DRAFT": return { label: "Not paid", tone: "pending" };
    case "PAID_HELD": return handoverAt ? { label: "Handed over", tone: "handover" } : { label: "Rent held", tone: "held" };
    case "MOVE_IN_CONFIRMED":
    case "AUTO_CONFIRMED":
    case "PAID_OUT": return { label: "Paid out", tone: "done" };
    case "DISPUTED": return { label: "In dispute", tone: "alert" };
    case "REFUNDED": return { label: "Refunded", tone: "neutral" };
    case "CANCELLED":
    case "STUDENT_CANCELLED": return { label: "Cancelled", tone: "neutral" };
  }
}

/** Listing states for landlords and agents (docs/listing-api.md). */
export function lodgeChip(status: "draft" | "pending_review" | "verified" | "suspended", reviewNote: string | null): StatusChip {
  switch (status) {
    case "draft": return reviewNote ? { label: "Needs changes", tone: "alert" } : { label: "Draft", tone: "pending" };
    case "pending_review": return { label: "In review", tone: "handover" };
    case "verified": return { label: "Live", tone: "done" };
    case "suspended": return { label: "Suspended", tone: "neutral" };
  }
}
