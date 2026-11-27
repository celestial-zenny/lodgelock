// LodgeLock: Interswitch Marketplace sandbox check (NIN, BVN Boolean Match, bank account).
// Run on your own computer from the repo root (Node 18+): node scripts/kyc-sandbox-check.mjs
// Keys come from environment variables and are never printed.
//   read -rp "Client ID: " ISW_CLIENT_ID; read -rsp "Client Secret: " ISW_CLIENT_SECRET; echo
//   export ISW_CLIENT_ID ISW_CLIENT_SECRET
//   node scripts/kyc-sandbox-check.mjs
// Uses sandbox TEST numbers only. Never put a real NIN or BVN in here.

const id = process.env.ISW_CLIENT_ID, secret = process.env.ISW_CLIENT_SECRET;
if (!id || !secret) { console.error("Set ISW_CLIENT_ID and ISW_CLIENT_SECRET first (see the top of this file)."); process.exit(1); }

const PASSPORTS = [
  "https://passport-sandbox.interswitchng.com/passport/oauth/token",
  "https://sandbox.interswitchng.com/passport/oauth/token",
  "https://qa.interswitchng.com/passport/oauth/token",
];
const BASES = [
  "https://api-marketplace-routing.k8.isw.la/marketplace-routing/api/v1",
  "https://sandbox.interswitchng.com/marketplace-routing/api/v1",
];
// Sandbox test values from community guides; replace if your project's docs list others.
const TEST = { nin: "11111111111", bvn: "11111111111", firstName: "Test", lastName: "User" };

const short = (s, n = 700) => (s.length > n ? s.slice(0, n) + " …" : s);
async function req(url, init) {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
    return { status: r.status, text: await r.text() };
  } catch (e) { return { status: 0, text: String(e.cause?.code ?? e.message) }; }
}

let token = null;
for (const url of PASSPORTS) {
  const r = await req(url, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "profile" }),
  });
  let body = null; try { body = JSON.parse(r.text); } catch {}
  console.log(`TOKEN  ${url}\n  -> HTTP ${r.status} ${body?.access_token ? "token OK (hidden)" : short(r.text.replace(/\s+/g, " "), 160)}`);
  if (body?.access_token && !token) token = body.access_token;
}
if (!token) { console.log("\nNo token from any Passport URL: check the Client ID/Secret are the project's TEST keys."); process.exit(0); }

const calls = [
  ["NIN", "POST", "/verify/identity/nin", { nin: TEST.nin, firstName: TEST.firstName, lastName: TEST.lastName }],
  ["BVN boolean match", "POST", "/verify/identity/bvn/verify", { bvn: TEST.bvn, firstName: TEST.firstName, lastName: TEST.lastName }],
  ["Bank list", "GET", "/verify/identity/account-number/bank-list", null],
];
for (const base of BASES) {
  console.log(`\nBASE ${base}`);
  for (const [label, method, path, body] of calls) {
    const r = await req(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    console.log(`  ${label}: HTTP ${r.status}\n    ${short(r.text.replace(/\s+/g, " "), label === "Bank list" ? 300 : 700)}`);
  }
}
console.log("\nDone. Paste everything above back into the chat (no keys are in it).");
