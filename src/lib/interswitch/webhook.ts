import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Interswitch signs webhooks with HMAC-SHA512 over the RAW request body using your secret key,
 * hex-encoded in the `X-Interswitch-Signature` header. Verify before parsing.
 */
export function verifyInterswitchSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const given = header.trim().toLowerCase();
  if (given.length !== expected.length || !/^[0-9a-f]+$/.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"));
}

/** Stable id for dedupe: the event uuid if present, otherwise a hash of the body. */
export function webhookEventRef(payload: unknown, rawBody: string): string {
  const uuid = (payload as { uuid?: unknown })?.uuid;
  return typeof uuid === "string" && uuid.length > 0
    ? uuid
    : `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

/** Our merchant transaction ref, wherever this payload version puts it. */
export function webhookTxnRef(payload: unknown): string | null {
  const data = (payload as { data?: Record<string, unknown> })?.data ?? {};
  for (const k of ["merchantReference", "MerchantReference", "transactionReference", "txnRef", "txn_ref"]) {
    const v = data[k];
    if (typeof v === "string" && v.startsWith("LL-")) return v;
  }
  return null;
}
