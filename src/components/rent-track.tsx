import { Icon, type IconName } from "@/components/icons";

// The four money steps of a booking, drawn as a track. `current` is the index of the step the booking is at.
const STEPS: { label: string; icon: IconName }[] = [
  { label: "Not paid", icon: "bookings" },
  { label: "Rent held", icon: "lock" },
  { label: "Handed over", icon: "key" },
  { label: "Paid out", icon: "check" },
];

export function RentTrack({ current, dark = false, className = "" }: { current: number; dark?: boolean; className?: string }) {
  return (
    <ol className={`grid grid-cols-4 gap-1 ${className}`} aria-label="Booking progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const dot = now
          ? "bg-brass text-night ring-4 ring-brass/25"
          : done
            ? dark ? "bg-white/90 text-night" : "bg-brand text-brand-ink"
            : dark ? "border border-white/30 text-white/60" : "border border-line-strong/60 text-muted";
        const bar = i < current ? (dark ? "bg-white/80" : "bg-brand") : dark ? "bg-white/20" : "bg-line";
        return (
          <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={now ? "step" : undefined}>
            {i > 0 && (
              // Connector from the previous dot to this one (dots are 32px wide, 4px gap between columns).
              <span aria-hidden className={`absolute top-[15px] h-0.5 rounded-full ${bar}`}
                style={{ right: "calc(50% + 20px)", width: "calc(100% - 36px)" }} />
            )}
            <span className={`relative grid size-8 place-items-center rounded-full ${dot}`}>
              <Icon name={s.icon} width={16} height={16} strokeWidth={2.2} />
            </span>
            <span className={`mt-1.5 text-[0.72rem] font-semibold leading-tight ${now ? (dark ? "text-brass" : "text-ink") : dark ? "text-white/70" : "text-muted"}`}>
              {s.label}
              <span className="sr-only">{now ? " (current step)" : done ? " (done)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Which track step a booking is on, or null for states off the main path (cancelled, refunded, disputed). */
export function trackStep(status: string, handoverAt: string | null): number | null {
  if (status === "DRAFT") return 0;
  if (status === "PAID_HELD") return handoverAt ? 2 : 1;
  if (status === "MOVE_IN_CONFIRMED" || status === "AUTO_CONFIRMED" || status === "PAID_OUT") return 3;
  return null;
}
