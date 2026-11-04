import { createBrowserClient } from "@supabase/ssr";

/** Browser client (anon key, RLS applies). Reads only — all writes go through server actions. */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
