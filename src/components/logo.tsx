// The LodgeLock mark: a padlock whose shackle is a gable roof. The body is the lodge, the keyhole is its door.
// Keep in sync with the static copies in src/app/icon.svg and scripts/brand/ (icons, Open Graph image).

type MarkProps = { className?: string; tone?: "light" | "tile" };

/** `light`: indigo lock on a light background. `tile`: the app-icon version on an indigo square. */
export function LogoMark({ className = "size-8", tone = "light" }: MarkProps) {
  const tile = tone === "tile";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {tile && <rect width="48" height="48" rx="11" fill="var(--brand, #2c2f86)" />}
      <path
        d="M14 23.5V18.6L24 10l10 8.6v4.9"
        fill="none"
        stroke={tile ? "var(--brass, #f2b42b)" : "var(--brand, #2c2f86)"}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="10" y="22" width="28" height="19" rx="4.5" fill={tile ? "#ffffff" : "var(--brand, #2c2f86)"} />
      <path
        d="M24 26.2a3.2 3.2 0 0 1 1.7 5.9l.9 4.4h-5.2l.9-4.4a3.2 3.2 0 0 1 1.7-5.9Z"
        fill={tile ? "var(--brand, #2c2f86)" : "var(--brass, #f2b42b)"}
      />
    </svg>
  );
}

export function Logo({ className = "", markClassName = "size-8" }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[1.35rem] font-extrabold leading-none text-ink">LodgeLock</span>
    </span>
  );
}
