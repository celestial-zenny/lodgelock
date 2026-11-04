"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, inputClass } from "@/components/field";
import { ADULT_AGE, MIN_AGE, ageOn, todayInLagos } from "@/lib/auth/signup-schema";
import { signUp, type SignupState } from "./actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, null);
  const fe = state?.fieldErrors ?? {};
  const val = state?.values ?? {};

  const [dob, setDob] = useState(val.dob ?? "");
  const age = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? ageOn(dob, todayInLagos()) : null;
  const isMinor = age !== null && age >= MIN_AGE && age < ADULT_AGE;

  const err = (k: keyof typeof fe) =>
    fe[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.formError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.formError}
        </p>
      )}

      <Field label="Full name" htmlFor="fullName" error={fe.fullName}>
        <input id="fullName" name="fullName" autoComplete="name" required
          defaultValue={val.fullName} className={inputClass} {...err("fullName")} />
      </Field>

      <Field label="Email" htmlFor="email" error={fe.email}>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required
          defaultValue={val.email} className={inputClass} {...err("email")} />
      </Field>

      <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          className={inputClass} {...err("password")} />
      </Field>

      <Field label="Phone (optional)" htmlFor="phone" error={fe.phone}>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567"
          defaultValue={val.phone} className={inputClass} {...err("phone")} />
      </Field>

      <Field label="Date of birth" htmlFor="dob" error={fe.dob}
        hint="We use this only to check your age. We don't store it.">
        <input id="dob" name="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)}
          className={inputClass} {...err("dob")} />
      </Field>

      <Field label="I am a" htmlFor="role" error={fe.role}
        hint={isMinor ? "Under-18s can only sign up as students." : "Landlords and agents verify their identity later."}>
        <select id="role" name="role" defaultValue={val.role ?? "student"} className={inputClass} {...err("role")}>
          <option value="student">Student looking for a lodge</option>
          <option value="landlord" disabled={isMinor}>Landlord</option>
          <option value="agent" disabled={isMinor}>Agent</option>
        </select>
      </Field>

      {isMinor && (
        <fieldset className="space-y-4 rounded-xl border border-warn/30 bg-warn-soft p-4">
          <legend className="px-1 text-sm font-semibold text-warn">Parent or guardian consent</legend>
          <p className="text-sm text-foreground/80">
            You&apos;re under 18. Under the Nigeria Data Protection Act, a parent or guardian has to agree
            before we process your data. We&apos;ll contact them to confirm before you can pay for a lodge.
          </p>
          <Field label="Guardian's full name" htmlFor="guardianName" error={fe.guardianName}>
            <input id="guardianName" name="guardianName" defaultValue={val.guardianName}
              className={inputClass} {...err("guardianName")} />
          </Field>
          <Field label="Guardian's phone" htmlFor="guardianPhone" error={fe.guardianPhone}>
            <input id="guardianPhone" name="guardianPhone" type="tel" inputMode="tel"
              defaultValue={val.guardianPhone} className={inputClass} {...err("guardianPhone")} />
          </Field>
          <Field label="Relationship" htmlFor="guardianRelationship" error={fe.guardianRelationship}>
            <select id="guardianRelationship" name="guardianRelationship"
              defaultValue={val.guardianRelationship ?? ""} className={inputClass} {...err("guardianRelationship")}>
              <option value="" disabled>Choose…</option>
              <option value="parent">Parent</option>
              <option value="legal_guardian">Legal guardian</option>
            </select>
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="guardianConsent" defaultChecked={val.guardianConsent === "on"} className="mt-0.5 size-5 accent-[var(--brand)]" />
            <span>
              My parent or guardian has read the{" "}
              <Link href="/privacy" className="underline" target="_blank">Privacy Policy</Link>{" "}
              and agrees to me creating a LodgeLock account.
            </span>
          </label>
          {fe.guardianConsent && <p className="text-sm text-danger">{fe.guardianConsent}</p>}
        </fieldset>
      )}

      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" defaultChecked={val.acceptTerms === "on"} className="mt-0.5 size-5 accent-[var(--brand)]" />
          <span>
            I agree to the <Link href="/privacy#terms" className="underline" target="_blank">Terms</Link> and{" "}
            <Link href="/privacy" className="underline" target="_blank">Privacy Policy</Link>.
          </span>
        </label>
        {fe.acceptTerms && <p className="text-sm text-danger">{fe.acceptTerms}</p>}
      </div>

      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-brand underline">Log in</Link>
      </p>
    </form>
  );
}
