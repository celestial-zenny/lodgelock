import type { Trust } from "@/lib/lodges";
import { Icon, type IconName } from "@/components/icons";

export function Badge({ tone, icon, children }: { tone: "brand" | "warn" | "muted" | "leaf"; icon?: IconName; children: React.ReactNode }) {
  const cls = {
    brand: "bg-brand-soft text-brand",
    leaf: "bg-leaf-soft text-leaf",
    warn: "bg-brass-soft text-brass-ink",
    muted: "bg-line/70 text-muted",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {icon && <Icon name={icon} width={14} height={14} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

export function TrustBadges({ trust, isDemo, compact = false }: { trust: Trust | null; isDemo: boolean; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {trust?.ownerVerified && (
        <Badge tone="brand" icon="shield">ID-verified {trust.ownerRole === "agent" ? "agent" : "landlord"}</Badge>
      )}
      {trust?.inspectedAt
        ? <Badge tone="leaf" icon="check">Scout-inspected</Badge>
        : !compact && <Badge tone="muted">Not yet inspected</Badge>}
      {isDemo && <Badge tone="warn">{compact ? "Demo listing" : "Demo listing, illustrative price"}</Badge>}
    </div>
  );
}
