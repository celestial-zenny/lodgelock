"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/field";
import { revokeMandate, setCaretaker, signMandate, type FormState } from "./actions";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-sm text-brand">{state.ok}</p>;
  return null;
}

export function CaretakerForm({ lodgeId, current }: { lodgeId: string; current: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setCaretaker, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <label htmlFor={`ct-${lodgeId}`} className="block text-sm font-medium">
        Caretaker {current && <span className="font-normal text-muted">· now: {current}</span>}
      </label>
      <div className="flex gap-2">
        <input id={`ct-${lodgeId}`} name="email" type="email" placeholder="caretaker@email.com" className={inputClass} />
        <button disabled={pending} className="shrink-0 rounded-lg border border-line px-3 text-sm font-medium disabled:opacity-60">
          {pending ? "…" : "Save"}
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
        <button disabled={revoking} className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger disabled:opacity-60">
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
        <input type="checkbox" name="agree" className="mt-0.5 size-5" />
        <span>
          I authorise LodgeLock to pay rent for this lodge to {agentName}&apos;s verified bank account instead of mine,
          until I revoke this mandate.
        </span>
      </label>
      <button disabled={signing} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
        Sign payee mandate
      </button>
      <Status state={signState} />
    </form>
  );
}
