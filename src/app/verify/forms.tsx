"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/field";
import { BANKS } from "@/lib/kyc/banks";
import {
  grantKycConsent, submitKyc, withdrawKycConsent, type ConsentState, type KycState,
} from "./actions";

/** NDPA 2023: explicit, informed, purpose-specific consent before any NIN/BVN/bank check. */
export function ConsentForm() {
  const [state, action, pending] = useActionState<ConsentState, FormData>(grantKycConsent, null);
  return (
    <form action={action} className="space-y-4">
      <section aria-labelledby="why" className="space-y-3 rounded-xl border border-line bg-surface p-4 text-sm">
        <h2 id="why" className="text-base font-semibold">Before we check anything</h2>
        <p>
          LodgeLock verifies every landlord and agent so students know who they&apos;re paying. With your consent we
          will send these details to <b>Interswitch</b>, our verification partner, for three checks:
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><b>NIN check:</b> confirms your National Identification Number belongs to the name on your profile.</li>
          <li><b>BVN match:</b> a yes/no check that your Bank Verification Number matches your name. We never see your bank records.</li>
          <li><b>Bank account check:</b> confirms the account we&apos;ll pay rent into is in your name.</li>
        </ol>
        <p>
          <b>What we keep:</b> only whether each check passed, and when. We <b>never store or log</b> your NIN, BVN or
          account number. An admin then reviews the result before your listings show as verified.
        </p>
        <p>
          Lawful basis: your consent (NDPA 2023 s.25(1)(a)). You can withdraw it at any time. Without it you can still
          browse LodgeLock, but your listings can&apos;t be marked verified. Read our <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </section>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span>I consent to LodgeLock sending my NIN, BVN and bank account details to Interswitch for these three checks.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Saving…" : "I agree, continue"}
      </button>
    </form>
  );
}

export function DetailsForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState<KycState, FormData>(submitKyc, null);
  const fe = state?.fieldErrors ?? {};
  const err = (k: keyof typeof fe) => (fe[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-5" noValidate autoComplete="off">
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          We&apos;ll match against <b>{fullName}</b>. These numbers go straight to Interswitch and aren&apos;t saved.
        </p>
        {state?.error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

        <Field label="NIN" htmlFor="nin" error={fe.nin} hint="11 digits, on your NIN slip or NIMC app">
          <input id="nin" name="nin" inputMode="numeric" maxLength={11} pattern="\d{11}" required
            className={inputClass} {...err("nin")} />
        </Field>
        <Field label="BVN" htmlFor="bvn" error={fe.bvn} hint="11 digits. Dial *565*0# to see yours">
          <input id="bvn" name="bvn" inputMode="numeric" maxLength={11} pattern="\d{11}" required
            className={inputClass} {...err("bvn")} />
        </Field>
        <Field label="Bank" htmlFor="bankCode" error={fe.bankCode}>
          <select id="bankCode" name="bankCode" defaultValue="" required className={inputClass} {...err("bankCode")}>
            <option value="" disabled>Choose your bank</option>
            {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Account number" htmlFor="accountNumber" error={fe.accountNumber} hint="Where your rent payouts will go">
          <input id="accountNumber" name="accountNumber" inputMode="numeric" maxLength={10} pattern="\d{10}" required
            className={inputClass} {...err("accountNumber")} />
        </Field>

        <button disabled={pending} className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink disabled:opacity-60">
          {pending ? "Checking with Interswitch…" : "Run checks"}
        </button>
      </form>
      <form action={withdrawKycConsent}>
        <button className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium">
          Cancel and withdraw my consent
        </button>
      </form>
    </div>
  );
}
