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
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
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
        className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-medium text-brand underline">Create an account</Link>
      </p>
    </form>
  );
}
