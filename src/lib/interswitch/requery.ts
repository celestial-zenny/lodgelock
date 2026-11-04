import "server-only";
import { z } from "zod";
import { interswitchConfig } from "./config";

// Interswitch transaction query response (fields we rely on; others ignored).
const RequeryResponse = z.object({
  ResponseCode: z.string(),
  ResponseDescription: z.string().optional(),
  Amount: z.coerce.number().int().optional(),
  MerchantReference: z.string().optional(),
  PaymentReference: z.string().nullish(),
});

export type RequeryResult = {
  responseCode: string;
  description?: string;
  amountKobo: number | null;
  paymentReference: string | null;
};

/**
 * Server-side source of truth for a payment. Never trust the browser callback or a webhook body
 * on their own: always call this before giving value.
 */
export async function requeryTransaction(txnRef: string, amountKobo: number): Promise<RequeryResult> {
  const cfg = interswitchConfig();
  const url = new URL(cfg.requeryUrl);
  url.searchParams.set("merchantcode", cfg.merchantCode);
  url.searchParams.set("transactionreference", txnRef);
  url.searchParams.set("amount", String(amountKobo));

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Interswitch requery failed: HTTP ${res.status}`);

  const parsed = RequeryResponse.safeParse(await res.json());
  if (!parsed.success) throw new Error("Interswitch requery: unexpected response shape");

  // Interswitch returns the merchant ref it found; make sure it's the one we asked about.
  if (parsed.data.MerchantReference && parsed.data.MerchantReference !== txnRef) {
    throw new Error("Interswitch requery: reference mismatch");
  }
  return {
    responseCode: parsed.data.ResponseCode,
    description: parsed.data.ResponseDescription,
    amountKobo: parsed.data.Amount ?? null,
    paymentReference: parsed.data.PaymentReference ?? null,
  };
}
