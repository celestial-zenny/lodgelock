"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/field";
import { logIn, type LoginState } from "./actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(logIn, null);
  const error = state?.error ?? (linkError ? "That link has expired or was already used. Log in instead." : undefined);

  return (
    <form action={action} className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-signal-soft px-3 py-2.5 text-sm font-medium text-signal">
          {error}
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required
          defaultValue={state?.email} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className={inputClass} />
      </Field>
      <button type="submit" disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-medium text-brand underline">Create an account</Link>
      </p>
    </form>
  );
}
