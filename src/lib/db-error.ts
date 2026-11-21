import "server-only";

type DbError = { code?: string; message?: string; details?: string | null; hint?: string | null };

// Plain-language next step for the failures we actually hit in development.
const LIKELY_FIX: Record<string, string> = {
  "42703": "A column is missing: apply the pending files in supabase/migrations to this Supabase project.",
  "42P01": "A table is missing: apply the pending files in supabase/migrations to this Supabase project.",
  "42883": "A database function is missing: apply the pending files in supabase/migrations.",
  PGRST202: "An RPC function is missing or changed: apply the pending files in supabase/migrations.",
  PGRST204: "A column is missing from the API schema: apply pending migrations, then reload the schema cache.",
  "42501": "Permission denied by row-level security or grants.",
};

/**
 * Log the real database error on the server (terminal / Vercel logs) and return an Error to throw.
 * Logs only error metadata from Postgres/PostgREST: never query values or user data.
 * In production Next.js hides the thrown message from the browser; in dev the overlay shows it.
 */
export function dbFailure(context: string, error: DbError): Error {
  const fetchFailed = !error.code && /fetch failed|network|ENOTFOUND|ECONNREFUSED/i.test(error.message ?? "");
  const likelyFix = fetchFailed
    ? "Can't reach Supabase: check NEXT_PUBLIC_SUPABASE_URL in .env.local and your network."
    : error.code
      ? LIKELY_FIX[error.code]
      : undefined;

  console.error(`[db] ${context} failed`, {
    code: error.code || undefined,
    message: error.message,
    details: error.details || undefined,
    hint: error.hint || undefined,
    likelyFix,
  });

  const summary = [error.code, error.message].filter(Boolean).join(": ");
  return new Error(`${context} failed${summary ? ` (${summary})` : ""}${likelyFix ? `. ${likelyFix}` : ""}`);
}
