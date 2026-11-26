"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

type Tone = "success" | "info" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** Show a short confirmation. `const toast = useToast(); toast("Saved")`. */
export const useToast = () => useContext(ToastContext);

/** Toast once when `message` becomes truthy (e.g. a server action's success state). */
export function useToastOnChange(message: string | null | undefined, tone: Tone = "success") {
  const toast = useToast();
  const last = useRef<string | null | undefined>(null);
  useEffect(() => {
    if (message && message !== last.current) toast(message, tone);
    last.current = message;
  }, [message, tone, toast]);
}

const TONE: Record<Tone, string> = {
  success: "bg-night text-white [&_svg]:text-brass",
  info: "bg-night text-white [&_svg]:text-night-muted",
  error: "bg-signal text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div role="status" aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:items-end"
        style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 0.75rem)" }}>
        {toasts.map((t) => (
          <div key={t.id}
            className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-[0_10px_30px_-12px_rgba(19,21,58,0.55)] ${TONE[t.tone]}`}>
            <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "check"} className="mt-0.5 shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-lg opacity-80 hover:opacity-100">
              <Icon name="close" width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
