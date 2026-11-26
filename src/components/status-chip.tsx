import type { ChipTone } from "@/lib/booking/status-chip";
import { Icon, type IconName } from "@/components/icons";

const STYLE: Record<ChipTone, { cls: string; icon?: IconName; dot?: string }> = {
  pending: { cls: "bg-surface text-muted ring-1 ring-inset ring-line-strong/50", dot: "bg-line-strong" },
  held: { cls: "bg-night text-white", icon: "lock" },
  handover: { cls: "bg-brass-soft text-brass-ink ring-1 ring-inset ring-brass", icon: "key" },
  done: { cls: "bg-leaf-soft text-leaf", icon: "check" },
  alert: { cls: "bg-signal-soft text-signal", icon: "alert" },
  neutral: { cls: "bg-line/70 text-muted" },
};

/** Booking and listing states. The label is the text, so colour is never the only signal. */
export function StatusChip({ label, tone, className = "" }: { label: string; tone: ChipTone; className?: string }) {
  const s = STYLE[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls} ${className}`}>
      {s.icon ? <Icon name={s.icon} width={14} height={14} strokeWidth={2.2} className={tone === "held" ? "text-brass" : ""} />
        : s.dot ? <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} /> : null}
      {label}
    </span>
  );
}
