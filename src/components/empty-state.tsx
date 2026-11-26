import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/** An empty screen says what's missing and what to do next. */
export function EmptyState({ icon, title, children, action }: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong/40 bg-surface/60 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} width={28} height={28} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
