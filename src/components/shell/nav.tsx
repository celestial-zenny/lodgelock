"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName; match: string[]; exclude?: string[] };

function isActive(pathname: string, item: NavItem): boolean {
  const under = (m: string) => pathname === m || pathname.startsWith(`${m}/`);
  return item.match.some(under) && !(item.exclude ?? []).some(under);
}

/** Mobile bottom tab bar. Hidden from lg up, where the sidebar takes over. */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-brand" : "text-muted"}`}>
                <span className={`grid h-7 w-14 place-items-center rounded-full transition-colors ${active ? "bg-brand-soft" : ""}`}>
                  <Icon name={item.icon} width={22} height={22} strokeWidth={active ? 2.1 : 1.8} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sidebar links. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors ${
                  active ? "bg-brand text-brand-ink" : "text-ink hover:bg-brand-soft hover:text-brand"}`}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
