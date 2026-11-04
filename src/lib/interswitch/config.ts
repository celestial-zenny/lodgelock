import "server-only";

/**
 * Interswitch Web Checkout config. SANDBOX ONLY for this project: we refuse to run with
 * anything other than TEST mode so a misconfigured env can never take real money.
 *
 * Hostnames differ between Interswitch doc versions; both are env-configurable.
 * Defaults follow the current QuickStart (newwebpay-sandbox / sandbox hosts).
 */
export type InterswitchConfig = {
  merchantCode: string;
  payItemId: string;
  mode: "TEST";
  checkoutScriptUrl: string;
  requeryUrl: string;
  webhookSecret: string | undefined;
};

export function interswitchConfig(): InterswitchConfig {
  const mode = process.env.INTERSWITCH_MODE ?? "TEST";
  if (mode !== "TEST") throw new Error("LodgeLock is sandbox-only: INTERSWITCH_MODE must be TEST");

  const merchantCode = process.env.INTERSWITCH_MERCHANT_CODE;
  const payItemId = process.env.INTERSWITCH_PAY_ITEM_ID;
  if (!merchantCode || !payItemId) {
    throw new Error("Missing INTERSWITCH_MERCHANT_CODE / INTERSWITCH_PAY_ITEM_ID");
  }

  const checkoutScriptUrl =
    process.env.INTERSWITCH_CHECKOUT_SCRIPT_URL ?? "https://newwebpay-sandbox.interswitchng.com/inline-checkout.js";
  const requeryUrl =
    process.env.INTERSWITCH_REQUERY_URL ??
    "https://sandbox.interswitchng.com/collections/api/v1/gettransaction.json";

  for (const u of [checkoutScriptUrl, requeryUrl]) {
    const host = new URL(u).hostname;
    // Production hosts are newwebpay.interswitchng.com / webpay.interswitchng.com.
    if (!/(sandbox|qa)\./.test(host) && !host.includes("-sandbox")) {
      throw new Error(`Refusing non-sandbox Interswitch host: ${host}`);
    }
  }

  return {
    merchantCode,
    payItemId,
    mode: "TEST",
    checkoutScriptUrl,
    requeryUrl,
    webhookSecret: process.env.INTERSWITCH_WEBHOOK_SECRET || undefined,
  };
}
