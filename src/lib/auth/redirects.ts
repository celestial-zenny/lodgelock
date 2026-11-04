/** Only allow same-site relative paths, to prevent open redirects via ?next=. */
export function safeNext(next: unknown, fallback = "/lodges"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function siteUrl(originHeader: string | null): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? originHeader ?? "http://localhost:3000";
}
