import type { Trust } from "@/lib/lodges";

export function Badge({ tone, children }: { tone: "brand" | "warn" | "muted"; children: React.ReactNode }) {
  const cls = {
    brand: "bg-brand-soft text-brand",
    warn: "bg-warn-soft text-warn",
    muted: "bg-line/60 text-muted",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function TrustBadges({ trust, isDemo }: { trust: Trust | null; isDemo: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {trust?.ownerVerified && <Badge tone="brand">✓ ID-verified {trust.ownerRole === "agent" ? "agent" : "landlord"}</Badge>}
      {trust?.inspectedAt ? <Badge tone="brand">✓ Scout-inspected</Badge> : <Badge tone="muted">Not yet inspected</Badge>}
      {isDemo && <Badge tone="warn">Demo listing · Illustrative price</Badge>}
    </div>
  );
}
