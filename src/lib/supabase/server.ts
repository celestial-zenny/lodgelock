import "server-only";
import { cookies } from "next/headers";
import { io } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Acts as the signed-in user (or anon). RLS applies. Use this by default. */
export async function createUserClient() {
  const cookieStore = await cookies();
  // supabase-js reads Date.now() to check session expiry (getClaims/getSession). With Cache Components +
  // Partial Prefetching, cookies() can resolve during a runtime prerender, so that read would land in the
  // prerender ("Blocking Route: Date.now()"). io() suspends here during prerendering and is a no-op at request time.
  await io();
  return createServerClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
          }
        },
      },
    },
  );
}

/**
 * BYPASSES RLS. Only for webhook handlers, cron jobs and payment/payout transitions,
 * after the caller has authenticated the request (webhook signature, CRON_SECRET, admin check).
 */
export function createServiceClient() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
