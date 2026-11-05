"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { interswitchConfig } from "@/lib/interswitch/config";
import { settlePayment, type SettleOutcome } from "@/lib/payments/settle";
import { siteUrl } from "@/lib/auth/redirects";

const Uuid = z.uuid();

function dbErrorMessage(message: string | undefined): string {
  if (message?.includes("rate limit")) return "Too many attempts. Please wait a while and try again.";
  if (message?.includes("guardian confirmation")) {
    return "We need to confirm your parent or guardian's consent before you can book.";
  }
  if (message?.includes("only students")) return "Only student accounts can book lodges.";
  if (message?.includes("not bookable")) return "This lodge isn't available to book right now.";
  if (message?.includes("not awaiting payment")) return "This booking has already been paid or closed.";
  if (message?.includes("move-in date")) return "Choose a move-in date between today and about a year from now.";
  if (message?.includes("renewal must follow")) return "You can only renew a lodge you've already moved into.";
  if (message?.includes("bookings_one_renewal") || message?.includes("duplicate key")) return "You've already started a renewal for this tenancy.";
  return "Something went wrong. Please try again.";
}

export type BookState = { error?: string } | null;

/** Lagos calendar date, YYYY-MM-DD. */
function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const BookInput = z.object({
  lodgeId: z.uuid(),
  moveInDate: z.iso.date({ message: "Choose your move-in date" }),
  renewalOf: z.uuid().optional(),
});

export async function createBooking(_prev: BookState, formData: FormData): Promise<BookState> {
  const parsed = BookInput.safeParse({
    lodgeId: formData.get("lodgeId"),
    moveInDate: formData.get("moveInDate"),
    renewalOf: formData.get("renewalOf") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.moveInDate < lagosToday()) return { error: "Move-in date can't be in the past." };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/lodges/${parsed.data.lodgeId}`);

  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_lodge: parsed.data.lodgeId,
    p_move_in_date: parsed.data.moveInDate,
    p_renewal_of: parsed.data.renewalOf,
  });
  if (error || !bookingId) return { error: dbErrorMessage(error?.message) };
  redirect(`/bookings/${bookingId}`);
}

export type CheckoutParams = {
  scriptUrl: string;
  request: {
    merchant_code: string;
    pay_item_id: string;
    pay_item_name: string;
    txn_ref: string;
    amount: number;
    currency: number;
    mode: "TEST";
    cust_email?: string;
    cust_name?: string;
    cust_id: string;
    site_redirect_url: string;
  };
};

export async function startPayment(bookingId: string): Promise<{ error: string } | { checkout: CheckoutParams }> {
  const id = Uuid.safeParse(bookingId);
  if (!id.success) return { error: "Invalid booking." };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Please log in again." };

  let cfg;
  try {
    cfg = interswitchConfig();
  } catch (e) {
    console.error((e as Error).message);
    return { error: "Payments aren't configured yet." };
  }

  // Server decides the reference and amount; the browser only receives them.
  const { data, error } = await supabase.rpc("begin_payment", { p_booking: id.data });
  const attempt = data?.[0];
  if (error || !attempt) return { error: dbErrorMessage(error?.message) };

  const meta = (auth.claims.user_metadata ?? {}) as { full_name?: string };
  const origin = siteUrl((await headers()).get("origin"));
  return {
    checkout: {
      scriptUrl: cfg.checkoutScriptUrl,
      request: {
        merchant_code: cfg.merchantCode,
        pay_item_id: cfg.payItemId,
        pay_item_name: "LodgeLock rent (held until move-in)",
        txn_ref: attempt.txn_ref,
        amount: attempt.amount_kobo,
        currency: 566, // NGN
        mode: cfg.mode,
        cust_email: typeof auth.claims.email === "string" ? auth.claims.email : undefined,
        cust_name: meta.full_name,
        cust_id: auth.claims.sub,
        site_redirect_url: `${origin}/bookings/${id.data}?ref=${attempt.txn_ref}`,
      },
    },
  };
}

/** Browser says "I'm done" — we re-query Interswitch server-side and record the truth. */
export async function verifyPayment(bookingId: string, txnRef: string): Promise<{ outcome: SettleOutcome }> {
  const id = Uuid.safeParse(bookingId);
  const ref = z.string().regex(/^LL-[0-9A-F]{16}$/).safeParse(txnRef);
  if (!id.success || !ref.success) return { outcome: "unknown_ref" };

  // Ownership check through RLS: the student can only see attempts on their own bookings.
  const supabase = await createUserClient();
  const { data: attempt } = await supabase
    .from("payment_attempts")
    .select("txn_ref")
    .eq("booking_id", id.data)
    .eq("txn_ref", ref.data)
    .maybeSingle();
  if (!attempt) return { outcome: "unknown_ref" };

  return { outcome: await settlePayment(attempt.txn_ref) };
}

export type ActionState = { error?: string; done?: string } | null;

async function bookingRpc(
  formData: FormData,
  rpc: "confirm_move_in" | "mark_handover" | "cancel_booking",
): Promise<ActionState> {
  const id = Uuid.safeParse(formData.get("bookingId"));
  if (!id.success) return { error: "Invalid booking." };
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/bookings/${id.data}`);

  const { data, error } = await supabase.rpc(rpc, { p_booking: id.data });
  if (error) {
    if (/not awaiting|can't be cancelled/.test(error.message)) {
      return { error: "This booking has already moved on. Refresh the page." };
    }
    return { error: "We couldn't save that. Please try again." };
  }
  revalidatePath(`/bookings/${id.data}`);
  revalidatePath("/bookings");
  return { done: String(data) };
}

/** Student: "I've moved in and the lodge matches" -> payout released now. */
export async function confirmMoveIn(_prev: ActionState, formData: FormData) {
  return bookingRpc(formData, "confirm_move_in");
}

/** Landlord, agent or caretaker: "Keys handed over" -> starts the 48h auto-release clock. */
export async function markHandover(_prev: ActionState, formData: FormData) {
  return bookingRpc(formData, "mark_handover");
}

/** Student cancels (no landlord fault). The DB decides grace vs late and books the refund. */
export async function cancelBooking(_prev: ActionState, formData: FormData) {
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm you want to cancel." };
  return bookingRpc(formData, "cancel_booking");
}

const DisputeInput = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().min(10, "Tell us what's wrong (at least 10 characters)").max(2000),
});

export type DisputeState = { error?: string } | null;

export async function raiseDispute(_prev: DisputeState, formData: FormData): Promise<DisputeState> {
  const parsed = DisputeInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/bookings/${parsed.data.bookingId}`);

  const { error } = await supabase.rpc("raise_dispute", { p_booking: parsed.data.bookingId, p_reason: parsed.data.reason });
  if (error) {
    if (error.message.includes("window closed")) return { error: "The dispute window for this booking has closed." };
    return { error: "We couldn't open a dispute. Please try again." };
  }
  revalidatePath(`/bookings/${parsed.data.bookingId}`);
  return null;
}
