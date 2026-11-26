import type { ReactNode } from "react";

export const inputClass =
  "block min-h-12 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-base text-ink outline-none " +
  "focus:border-brand focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-signal";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
