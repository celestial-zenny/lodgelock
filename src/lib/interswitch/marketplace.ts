import "server-only";
import { z } from "zod";

/**
 * Interswitch API Marketplace client (KYC: NIN, BVN Boolean Match, Bank Account Verification).
 *
 * - OAuth2 client-credentials token from Passport, cached in memory until shortly before expiry.
 * - SANDBOX ONLY: refuses hosts that aren't Interswitch test hosts.
 * - Never logs or returns the client secret, the access token, request bodies or provider responses.
 *   Callers get a pass/fail boolean and nothing else, so raw NIN/BVN/identity data can't leak upward.
 *
 * Endpoint paths follow the Marketplace "verify/identity" routes and are overridable via env in case
 * your project page lists different ones.
 */

export type MarketplaceConfig = {
  clientId: string;
  clientSecret: string;
  passportUrl: string;
  baseUrl: string;
  paths: { nin: string; bvnMatch: string; bankAccount: string; bankList: string };
};

const DEFAULTS = {
  passportUrl: "https://qa.interswitchng.com/passport/oauth/token",
  baseUrl: "https://api-marketplace-routing.k8.isw.la/marketplace-routing/api/v1",
  paths: {
    nin: "/verify/identity/nin",
    bvnMatch: "/verify/identity/bvn/verify",
    bankAccount: "/verify/identity/account-number/resolve",
    bankList: "/verify/identity/account-number/bank-list",
  },
};

/** Interswitch test/sandbox hosts only. Production would be e.g. passport.interswitchng.com. */
export function isSandboxHost(hostname: string): boolean {
  return /(^|\.)(sandbox|qa)\./.test(hostname) || hostname.includes("-sandbox") || hostname.endsWith(".k8.isw.la");
}

export function marketplaceConfig(env: NodeJS.ProcessEnv = process.env): MarketplaceConfig {
  if ((env.INTERSWITCH_MODE ?? "TEST") !== "TEST") {
    throw new Error("LodgeLock is sandbox-only: INTERSWITCH_MODE must be TEST");
  }
  const clientId = env.INTERSWITCH_CLIENT_ID;
  const clientSecret = env.INTERSWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing INTERSWITCH_CLIENT_ID / INTERSWITCH_CLIENT_SECRET");

  const cfg: MarketplaceConfig = {
    clientId,
    clientSecret,
    passportUrl: env.INTERSWITCH_PASSPORT_URL || DEFAULTS.passportUrl,
    baseUrl: (env.INTERSWITCH_MARKETPLACE_BASE_URL || DEFAULTS.baseUrl).replace(/\/+$/, ""),
    paths: {
      nin: env.INTERSWITCH_KYC_NIN_PATH || DEFAULTS.paths.nin,
      bvnMatch: env.INTERSWITCH_KYC_BVN_PATH || DEFAULTS.paths.bvnMatch,
      bankAccount: env.INTERSWITCH_KYC_BANK_PATH || DEFAULTS.paths.bankAccount,
      bankList: env.INTERSWITCH_KYC_BANK_LIST_PATH || DEFAULTS.paths.bankList,
    },
  };
  for (const u of [cfg.passportUrl, cfg.baseUrl]) {
    const url = new URL(u);
    if (url.protocol !== "https:") throw new Error("Interswitch URLs must be https");
    if (!isSandboxHost(url.hostname)) throw new Error(`Refusing non-sandbox Interswitch host: ${url.hostname}`);
  }
  return cfg;
}

/** Safe-to-log error: carries only an HTTP status / short code, never bodies, tokens or identifiers. */
export class MarketplaceError extends Error {
  readonly code: "config" | "auth" | "unavailable" | "bad_response";
  readonly status?: number;
  constructor(code: MarketplaceError["code"], status?: number) {
    super(`Interswitch Marketplace ${code}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "MarketplaceError";
    this.code = code;
    this.status = status;
  }
}

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive().optional(),
});

// Every Marketplace response is wrapped like { success, code, message, data }. We read only what we need.
const Envelope = z.object({
  success: z.boolean().optional(),
  data: z.unknown().optional(),
});

export type CheckOutcome = { passed: boolean };
export type Bank = { code: string; name: string };

/** Reads a "does this field match" flag across the response shapes Marketplace providers use. */
function matchFlag(obj: unknown, key: string): boolean | undefined {
  const v = (obj as Record<string, unknown> | null | undefined)?.[key];
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "false") return v === "true";
  if (v && typeof v === "object") {
    for (const k of ["fieldMatches", "match", "matched", "isMatch", "status"]) {
      const inner = (v as Record<string, unknown>)[k];
      if (typeof inner === "boolean") return inner;
    }
  }
  return undefined;
}

const normaliseName = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(Boolean);

/** True if the returned name contains both the expected first and last name (any order, case-insensitive). */
export function namesMatch(expected: { firstName: string; lastName: string }, returned: string): boolean {
  const got = new Set(normaliseName(returned));
  const want = [...normaliseName(expected.firstName), ...normaliseName(expected.lastName)];
  return want.length > 0 && want.every((t) => got.has(t));
}

type FetchLike = typeof fetch;

export function createMarketplaceClient(cfg: MarketplaceConfig, fetchImpl: FetchLike = fetch) {
  let cached: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    let res: Response;
    try {
      res = await fetchImpl(cfg.passportUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: "profile" }).toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new MarketplaceError("unavailable");
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new MarketplaceError("auth", res.status);
    if (!res.ok) throw new MarketplaceError("unavailable", res.status);
    const parsed = TokenResponse.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new MarketplaceError("bad_response");
    const ttlMs = (parsed.data.expires_in ?? 3600) * 1000;
    // Refresh a minute early (or at half-life for very short tokens).
    cached = { token: parsed.data.access_token, expiresAt: Date.now() + Math.max(ttlMs - 60_000, ttlMs / 2) };
    return cached.token;
  }

  async function token(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) return cached.token;
    inflight ??= fetchToken().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  /** Calls a Marketplace route; on 401 refreshes the token once. Returns parsed `data` or null on "not found". */
  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: boolean; data: unknown }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = await token();
      let res: Response;
      try {
        res = await fetchImpl(`${cfg.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${t}`,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        throw new MarketplaceError("unavailable");
      }
      if (res.status === 401 && attempt === 0) {
        cached = null;
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new MarketplaceError("auth", res.status);
      // 400/404/422: the provider looked and the identity didn't check out. That's a FAIL, not an outage.
      if ([400, 404, 422].includes(res.status)) return { ok: false, data: null };
      if (!res.ok) throw new MarketplaceError("unavailable", res.status);
      const env = Envelope.safeParse(await res.json().catch(() => null));
      if (!env.success) throw new MarketplaceError("bad_response");
      return { ok: env.data.success !== false, data: env.data.data ?? null };
    }
    throw new MarketplaceError("auth", 401);
  }

  return {
    /** NIN lookup; passes only if a record is found AND its name matches the profile name. */
    async verifyNin(input: { nin: string; firstName: string; lastName: string }): Promise<CheckOutcome> {
      const { ok, data } = await call("POST", cfg.paths.nin, {
        nin: input.nin,
        firstName: input.firstName,
        lastName: input.lastName,
      });
      if (!ok || !data || typeof data !== "object") return { passed: false };
      const d = data as Record<string, unknown>;
      if (typeof d.status === "string" && !/^(found|verified|valid|success)$/i.test(d.status)) return { passed: false };
      // Prefer explicit match flags if the provider returns them; otherwise compare names ourselves.
      const fn = matchFlag(d.fieldMatches ?? d, "firstName");
      const ln = matchFlag(d.fieldMatches ?? d, "lastName");
      if (fn !== undefined && ln !== undefined) return { passed: fn && ln };
      const name = [d.firstName ?? d.firstname, d.middleName ?? d.middlename, d.lastName ?? d.lastname ?? d.surname]
        .filter((x): x is string => typeof x === "string")
        .join(" ");
      return { passed: name.length > 0 && namesMatch(input, name) };
    },

    /** BVN Boolean Match: provider returns per-field booleans; we require first AND last name to match. */
    async bvnBooleanMatch(input: { bvn: string; firstName: string; lastName: string }): Promise<CheckOutcome> {
      const { ok, data } = await call("POST", cfg.paths.bvnMatch, {
        bvn: input.bvn,
        firstName: input.firstName,
        lastName: input.lastName,
      });
      if (!ok || !data || typeof data !== "object") return { passed: false };
      const d = data as Record<string, unknown>;
      const src = (d.fieldMatches ?? d.bvn ?? d) as Record<string, unknown>;
      const fn = matchFlag(src, "firstName");
      const ln = matchFlag(src, "lastName");
      return { passed: fn === true && ln === true };
    },

    /** Name enquiry on the payout account; passes if the account resolves to the profile name. */
    async verifyBankAccount(input: {
      accountNumber: string;
      bankCode: string;
      firstName: string;
      lastName: string;
    }): Promise<CheckOutcome> {
      const { ok, data } = await call("POST", cfg.paths.bankAccount, {
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
      });
      if (!ok || !data || typeof data !== "object") return { passed: false };
      const d = data as Record<string, unknown>;
      const details = (d.bankDetails ?? d) as Record<string, unknown>;
      const accountName = details.accountName ?? details.account_name;
      return { passed: typeof accountName === "string" && namesMatch(input, accountName) };
    },

    async listBanks(): Promise<Bank[]> {
      const { ok, data } = await call("GET", cfg.paths.bankList);
      if (!ok || !Array.isArray(data)) return [];
      return data
        .map((b) => {
          const r = b as Record<string, unknown>;
          const code = r.code ?? r.bankCode ?? r.cbnCode;
          const name = r.name ?? r.bankName;
          return typeof code === "string" && typeof name === "string" ? { code, name } : null;
        })
        .filter((b): b is Bank => b !== null);
    },
  };
}

export type MarketplaceClient = ReturnType<typeof createMarketplaceClient>;

let singleton: MarketplaceClient | null = null;

/** Process-wide client so the token cache is shared across requests on a warm instance. */
export function marketplace(): MarketplaceClient {
  singleton ??= createMarketplaceClient(marketplaceConfig());
  return singleton;
}
