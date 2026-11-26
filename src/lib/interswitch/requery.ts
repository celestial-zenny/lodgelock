import "server-only";
import { z } from "zod";
import { INTERSWITCH_USER_AGENT, interswitchConfig, type InterswitchConfig } from "./config";

// Interswitch transaction query response (fields we rely on; others ignored).
const RequeryResponse = z.object({
  ResponseCode: z.string(),
  ResponseDescription: z.string().optional(),
  Amount: z.coerce.number().int().optional(),
  MerchantReference: z.string().nullish(),
  PaymentReference: z.string().nullish(),
});

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive().optional(),
});

export type RequeryResult = {
  responseCode: string;
  description?: string;
  amountKobo: number | null;
  paymentReference: string | null;
};

// One token per server instance, reused until a minute before it expires (Interswitch issues ~1 hour tokens).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(cfg: InterswitchConfig, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetch(cfg.passportUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": INTERSWITCH_USER_AGENT,
    },
    // grant_type goes in the body only: sending it in the query string as well is rejected.
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Interswitch token request failed: HTTP ${res.status}`);
  const parsed = TokenResponse.safeParse(await res.json());
  if (!parsed.success) throw new Error("Interswitch token: unexpected response shape");

  const ttlMs = (parsed.data.expires_in ?? 3600) * 1000;
  cachedToken = { value: parsed.data.access_token, expiresAt: Date.now() + Math.max(ttlMs - 60_000, 30_000) };
  return cachedToken.value;
}

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

  const query = async (token: string) =>
    fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": INTERSWITCH_USER_AGENT,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

  let res = await query(await accessToken(cfg));
  if (res.status === 401) res = await query(await accessToken(cfg, true)); // token revoked/expired early
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
