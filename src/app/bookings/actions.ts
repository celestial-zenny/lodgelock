"use server";

import { redirect } from "next/navigation";
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
  return "Something went wrong. Please try again.";
}

export type BookState = { error?: string } | null;

export async function createBooking(_prev: BookState, formData: FormData): Promise<BookState> {
  const lodgeId = Uuid.safeParse(formData.get("lodgeId"));
  if (!lodgeId.success) return { error: "Invalid lodge." };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/lodges/${lodgeId.data}`);

  const { data: bookingId, error } = await supabase.rpc("create_booking", { p_lodge: lodgeId.data });
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
