"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/field";
import { useToastOnChange } from "@/components/toast";
import { btn } from "@/components/ui";
import { revokeMandate, setCaretaker, signMandate, type FormState } from "./actions";

function Status({ state }: { state: FormState }) {
  useToastOnChange(state?.ok);
  if (state?.error) return <p role="alert" className="text-sm text-signal">{state.error}</p>;
  return null;
}

export function CaretakerForm({ lodgeId, current }: { lodgeId: string; current: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setCaretaker, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <label htmlFor={`ct-${lodgeId}`} className="block text-sm font-semibold">
        Caretaker {current && <span className="font-normal text-muted">(now: {current})</span>}
      </label>
      <div className="flex gap-2">
        <input id={`ct-${lodgeId}`} name="email" type="email" placeholder="caretaker@email.com" className={inputClass} />
        <button disabled={pending} className={`${btn.secondary} shrink-0 px-4 text-sm`}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted">Caretakers can show the lodge and mark keys handed over. They never receive payouts. Leave empty and save to remove.</p>
      <Status state={state} />
    </form>
  );
}

export function MandateForm({ lodgeId, agentId, agentName, active }: {
  lodgeId: string;
  agentId: string;
  agentName: string;
  active: boolean;
}) {
  const [signState, sign, signing] = useActionState<FormState, FormData>(signMandate, null);
  const [revokeState, revoke, revoking] = useActionState<FormState, FormData>(revokeMandate, null);
  if (active) {
    return (
      <form action={revoke} className="space-y-2">
        <input type="hidden" name="lodgeId" value={lodgeId} />
        <p className="text-sm">Rent for this lodge is paid to <b>{agentName}</b> under your signed payee mandate.</p>
        <button disabled={revoking} className={`${btn.small} border border-signal text-signal hover:bg-signal-soft`}>
          Revoke mandate
        </button>
        <Status state={revokeState} />
      </form>
    );
  }
  return (
    <form action={sign} className="space-y-2">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <input type="hidden" name="agentId" value={agentId} />
      <p className="text-sm">Rent is paid to you. You can instead let your verified agent <b>{agentName}</b> collect it.</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span>
          I authorise LodgeLock to pay rent for this lodge to {agentName}&apos;s verified bank account instead of mine,
          until I revoke this mandate.
        </span>
      </label>
      <button disabled={signing} className={`${btn.small} bg-brand text-brand-ink hover:bg-brand-hover`}>
        Sign payee mandate
      </button>
      <Status state={signState} />
    </form>
  );
}
