import type { ReactNode } from "react";

// The held-rent note: every place the rent is held is printed like money. Deep note-green paper in a double
// frame, a guilloche rosette in the corner, a gold foil thread and a microtext rule. Decorative layers are
// aria-hidden; the content inside stays ordinary, readable text.

/** Booking serial in the note's style, derived from the booking id: "LL 7F3A 21C0". Display only. */
export function serialFor(id: string): string {
  const hex = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `LL ${hex.slice(0, 4)} ${hex.slice(4)}`;
}

const MICROTEXT = "LodgeLock rent held until move-in ".repeat(16);

export function Note({ children, serial, className = "", as: Tag = "div", ...rest }: {
  children: ReactNode;
  /** Shown top right, e.g. "No. LL 7F3A 21C0". */
  serial?: string;
  className?: string;
  as?: "div" | "section";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag {...rest} data-note
      className={`on-dark relative rounded-[14px] bg-night p-1.5 text-white shadow-[0_24px_48px_-28px_rgba(6,26,20,0.85)] ${className}`}>
      <div className="relative overflow-hidden rounded-[10px] border border-brass/35 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <span aria-hidden data-rosette className="print-rosette pointer-events-none absolute -top-24 -left-24 size-80 text-brass/30" />
        <span aria-hidden data-foil className="foil pointer-events-none absolute inset-y-0 right-5 w-1.5 sm:right-8" />
        {serial && (
          <p className="serial relative mr-6 text-right text-brass sm:mr-8">
            <span className="sr-only">Booking reference </span>{serial}
          </p>
        )}
        <div className="relative pr-6 sm:pr-8">{children}</div>
        <p aria-hidden className="microtext relative mt-5 mr-6 text-night-muted/60 sm:mr-8">{MICROTEXT}</p>
      </div>
    </Tag>
  );
}
