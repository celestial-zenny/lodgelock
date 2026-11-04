import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in — LodgeLock" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Log in</h1>
      <Suspense fallback={<LoginForm />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginWithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next) : undefined;
  return <LoginForm next={next} linkError={sp.error === "link"} />;
}
