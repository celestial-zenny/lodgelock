import Link from "next/link";
import { Suspense } from "react";
import { createUserClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand text-sm text-brand-ink">
            L
          </span>
          LodgeLock
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/lodges" className="rounded-md px-3 py-2 hover:bg-brand-soft">
            Lodges
          </Link>
          <Suspense fallback={<span className="w-32" aria-hidden />}>
            <HeaderAuth />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

/** Reads the session cookie, so it streams in behind the Suspense boundary above. */
async function HeaderAuth() {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const name = (data?.claims?.user_metadata as { full_name?: string } | undefined)?.full_name;
  if (data?.claims) {
    return (
      <form action={signOut} className="flex items-center gap-1">
        <span className="hidden px-2 text-muted sm:inline">{name?.split(" ")[0]}</span>
        <button className="rounded-md px-3 py-2 hover:bg-brand-soft">Log out</button>
      </form>
    );
  }
  return (
    <>
      <Link href="/login" className="rounded-md px-3 py-2 hover:bg-brand-soft">
        Log in
      </Link>
      <Link href="/signup" className="rounded-md bg-brand px-3 py-2 font-medium text-brand-ink">
        Sign up
      </Link>
    </>
  );
}
