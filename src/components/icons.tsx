// Small line icons drawn for LodgeLock (24px grid, 1.8 stroke). Decorative unless a label is passed.
import type { SVGProps } from "react";

export type IconName =
  | "lodges" | "bookings" | "account" | "dashboard" | "listings" | "check" | "shield" | "key" | "lock"
  | "walk" | "pin" | "plus" | "close" | "alert" | "arrow-left" | "camera" | "logout" | "info";

const PATHS: Record<IconName, React.ReactNode> = {
  lodges: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5V14h4v5.5" /></>,
  bookings: <><path d="M5 4.5h14v15l-2.3-1.5-2.4 1.5-2.3-1.5-2.4 1.5L7.3 18 5 19.5z" /><path d="M8.5 9h7M8.5 12.5h5" /></>,
  account: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" /></>,
  dashboard: <><rect x="4" y="4" width="7" height="8" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="14" width="7" height="6" rx="1.5" /></>,
  listings: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16.5 6.5l2 2M14 9l1.8 1.8" /></>,
  lock: <><path d="M7.5 11V8.2L12 4.5l4.5 3.7V11" /><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M12 14.5v2" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6 3 3v3M8 11l2.5-3.5 3 1.5 2 3.5 2.5 1M12 15l-1.5-4.5" /></>,
  pin: <><path d="M12 20.5s6-5.6 6-10.5a6 6 0 0 0-12 0c0 4.9 6 10.5 6 10.5z" /><circle cx="12" cy="10" r="2.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17v.01" /></>,
  "arrow-left": <path d="M19 12H5m6-6-6 6 6 6" />,
  camera: <><path d="M4 8.5h3.5L9 6h6l1.5 2.5H20v10H4z" /><circle cx="12" cy="13" r="3.2" /></>,
  logout: <><path d="M14 4.5H6v15h8" /><path d="M11 12h9m-3-3 3 3-3 3" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>,
};

export function Icon({ name, label, ...props }: { name: IconName; label?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
      strokeLinejoin="round" width={20} height={20} role={label ? "img" : undefined} aria-label={label}
      aria-hidden={label ? undefined : true} focusable="false" {...props}>
      {PATHS[name]}
    </svg>
  );
}
