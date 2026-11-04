import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-lg border border-line bg-surface px-3 py-3 text-base outline-none " +
  "focus:border-brand focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-danger";

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
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
