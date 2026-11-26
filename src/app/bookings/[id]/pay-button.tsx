"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPayment, verifyPayment, type CheckoutParams } from "../actions";
import type { SettleOutcome } from "@/lib/payments/settle";
import { useToast } from "@/components/toast";
import { btn } from "@/components/ui";
import { Icon } from "@/components/icons";

declare global {
  interface Window {
    webpayCheckout?: (req: CheckoutParams["request"] & { onComplete: (resp: unknown) => void }) => void;
  }
}

const MESSAGES: Partial<Record<SettleOutcome, string>> = {
  pending: "We haven't received confirmation from Interswitch yet. If you completed payment, check again in a minute.",
  amount_mismatch: "The amount paid didn't match. We've flagged it for a refund. Contact support.",
  duplicate_payment: "This booking was already paid. Your extra payment is flagged for a refund.",
  unknown_ref: "We couldn't find that payment.",
  error: "We couldn't reach Interswitch to confirm. Try checking again shortly.",
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.webpayCheckout) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("checkout script failed to load")));
    if (!existing) {
      s.src = src;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

export function PayButton({ bookingId, pendingRef }: { bookingId: string; pendingRef: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [lastRef, setLastRef] = useState<string | null>(pendingRef);
  const checkedReturn = useRef(false);
  const toast = useToast();

  const check = (ref: string) =>
    startTransition(async () => {
      setMessage("Confirming your payment with Interswitch…");
      const { outcome } = await verifyPayment(bookingId, ref);
      if (outcome === "paid" || outcome === "already_paid") {
        setMessage(null);
        toast("Payment confirmed. Your rent is held until you move in.");
        router.refresh();
      } else {
        setMessage(MESSAGES[outcome] ?? MESSAGES.error!);
      }
    });

  // Returning from a redirect (?ref=...) — confirm once automatically.
  useEffect(() => {
    if (pendingRef && !checkedReturn.current) {
      checkedReturn.current = true;
      check(pendingRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRef]);

  const pay = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await startPayment(bookingId);
      if ("error" in res) return setMessage(res.error);
      try {
        await loadScript(res.checkout.scriptUrl);
      } catch {
        return setMessage("Couldn't open the payment window. Check your connection and try again.");
      }
      setLastRef(res.checkout.request.txn_ref);
      window.webpayCheckout!({
        ...res.checkout.request,
        // Whatever the widget reports, the server re-queries Interswitch before marking anything paid.
        onComplete: () => check(res.checkout.request.txn_ref),
      });
    });

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <p className="flex gap-3 text-sm text-muted">
        <Icon name="lock" className="mt-0.5 shrink-0 text-brand" />
        <span>When you pay, the money is held by our payment partner. The landlord is paid only after you collect the keys and confirm.</span>
      </p>
      <button onClick={pay} disabled={isPending} className={`${btn.primary} w-full`}>
        {isPending ? "Please wait…" : "Pay securely with Interswitch"}
      </button>
      {lastRef && (
        <button onClick={() => check(lastRef)} disabled={isPending} className={`${btn.secondary} w-full text-sm`}>
          I&apos;ve paid. Check payment status
        </button>
      )}
      {message && <p role="status" className="rounded-xl bg-brass-soft px-3 py-2.5 text-sm text-brass-ink">{message}</p>}
      <p className="text-center text-xs text-muted">Sandbox mode: use Interswitch test cards. No real money moves.</p>
    </div>
  );
}
