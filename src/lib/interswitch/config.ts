import "server-only";

/**
 * Interswitch Web Checkout config. SANDBOX ONLY for this project: we refuse to run with
 * anything other than TEST mode so a misconfigured env can never take real money.
 *
 * Defaults follow Interswitch's current QuickStart (docs.interswitchgroup.com):
 * - checkout script: newwebpay-sandbox.interswitchng.com/inline-checkout.js
 * - transaction query: sandbox.interswitchng.com/collections/api/v1/gettransaction (needs a Bearer token)
 * - token: passport-sandbox.interswitchng.com/passport/oauth/token (client credentials)
 *
 * Payment-gateway credentials use their own INTERSWITCH_PAY_* names because INTERSWITCH_CLIENT_ID /
 * _SECRET / _PASSPORT_URL belong to the API Marketplace (KYC) client.
 */
export type InterswitchConfig = {
  merchantCode: string;
  payItemId: string;
  mode: "TEST";
  checkoutScriptUrl: string;
  requeryUrl: string;
  passportUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string | undefined;
};

// Interswitch's shared, published sandbox merchant ("no signup required"). Only used with merchant MX6072.
const SHARED_SANDBOX = {
  merchantCode: "MX6072",
  clientId: "IKIAB23A4E2756605C1ABC33CE3C287E27267F660D61",
  clientSecret: "secret",
};

/** Sent on every server call: the sandbox drops requests from generic clients such as curl. */
export const INTERSWITCH_USER_AGENT = "LodgeLock/1.0 (+https://lodgelock-nine.vercel.app)";

export function interswitchConfig(env: NodeJS.ProcessEnv = process.env): InterswitchConfig {
  const mode = env.INTERSWITCH_MODE ?? "TEST";
  if (mode !== "TEST") throw new Error("LodgeLock is sandbox-only: INTERSWITCH_MODE must be TEST");

  const merchantCode = env.INTERSWITCH_MERCHANT_CODE;
  const payItemId = env.INTERSWITCH_PAY_ITEM_ID;
  if (!merchantCode || !payItemId) {
    throw new Error("Missing INTERSWITCH_MERCHANT_CODE / INTERSWITCH_PAY_ITEM_ID");
  }

  const usingSharedMerchant = merchantCode === SHARED_SANDBOX.merchantCode;
  const clientId = env.INTERSWITCH_PAY_CLIENT_ID || (usingSharedMerchant ? SHARED_SANDBOX.clientId : "");
  const clientSecret = env.INTERSWITCH_PAY_CLIENT_SECRET || (usingSharedMerchant ? SHARED_SANDBOX.clientSecret : "");
  if (!clientId || !clientSecret) {
    throw new Error("Missing INTERSWITCH_PAY_CLIENT_ID / INTERSWITCH_PAY_CLIENT_SECRET for this merchant");
  }

  const checkoutScriptUrl =
    env.INTERSWITCH_CHECKOUT_SCRIPT_URL || "https://newwebpay-sandbox.interswitchng.com/inline-checkout.js";
  const requeryUrl =
    env.INTERSWITCH_REQUERY_URL || "https://sandbox.interswitchng.com/collections/api/v1/gettransaction";
  const passportUrl =
    env.INTERSWITCH_PAY_PASSPORT_URL || "https://passport-sandbox.interswitchng.com/passport/oauth/token";

  for (const u of [checkoutScriptUrl, requeryUrl, passportUrl]) {
    const url = new URL(u);
    if (url.protocol !== "https:") throw new Error("Interswitch URLs must be https");
    // Production hosts are newwebpay.interswitchng.com / webpay.interswitchng.com / passport.interswitchng.com.
    if (!/(^|\.)(sandbox|qa)\./.test(url.hostname) && !url.hostname.includes("-sandbox")) {
      throw new Error(`Refusing non-sandbox Interswitch host: ${url.hostname}`);
    }
  }

  return {
    merchantCode,
    payItemId,
    mode: "TEST",
    checkoutScriptUrl,
    requeryUrl,
    passportUrl,
    clientId,
    clientSecret,
    webhookSecret: env.INTERSWITCH_WEBHOOK_SECRET || undefined,
  };
}
