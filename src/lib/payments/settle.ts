import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { requeryTransaction } from "@/lib/interswitch/requery";
import { dbFailure } from "@/lib/db-error";

export type SettleOutcome =
  | "paid"
  | "already_paid"
  | "pending"
  | "amount_mismatch"
  | "duplicate_payment"
  | "unknown_ref"
  | "error";

/**
 * Requery Interswitch for `txnRef` and record the result atomically in the DB
 * (public.record_payment: DRAFT -> PAID_HELD + ledger entries). Idempotent; called from
 * the checkout callback, the webhook, and the "check payment" button.
 */
export async function settlePayment(txnRef: string): Promise<SettleOutcome> {
  let db;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error((e as Error).message);
    return "error";
  }
  const { data: attempt, error } = await db
    .from("payment_attempts")
    .select("txn_ref, amount_kobo, status")
    .eq("txn_ref", txnRef)
    .maybeSingle();
  if (error) {
    dbFailure("Loading payment attempt", error);
    return "error";
  }
  if (!attempt) return "unknown_ref";
  if (attempt.status === "succeeded") return "already_paid";

  let result;
  try {
    result = await requeryTransaction(attempt.txn_ref, attempt.amount_kobo);
  } catch (e) {
    console.error("requery failed", { txnRef, message: (e as Error).message });
    return "error";
  }

  const { data: outcome, error: rpcError } = await db.rpc("record_payment", {
    p_txn_ref: attempt.txn_ref,
    p_response_code: result.responseCode,
    p_amount_kobo: result.amountKobo,
    p_provider_ref: result.paymentReference,
  });
  if (rpcError) {
    console.error("record_payment failed", { txnRef, code: rpcError.code });
    return "error";
  }
  return outcome as SettleOutcome;
}
