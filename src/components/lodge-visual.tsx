import type { Enums } from "@/lib/supabase/database.types";
import { ROOM_TYPE_LABEL } from "@/lib/listing";

// Placeholder until a lodge has real photos. A drawn elevation, deliberately not a stock photo, so students never
// mistake it for the actual room. Each area gets its own ground colour.
const GROUND: Record<string, { bg: string; line: string }> = {
  Eziobodo: { bg: "#2c2f86", line: "#c9ccf0" },
  Umuchima: { bg: "#0f5b5f", line: "#bfe5e2" },
  Ihiagwa: { bg: "#5a2f7a", line: "#e2cdf2" },
};

// Window count hints at the room type: one door for a single room, more frontage for bigger units.
const BAYS: Record<Enums<"room_type">, number> = { single_room: 5, self_contain: 4, room_and_parlour: 3, flat: 2 };

export function LodgeVisual({ area, roomType, coverUrl, className = "", label = true }: {
  area: string;
  roomType: Enums<"room_type">;
  coverUrl?: string | null;
  className?: string;
  label?: boolean;
}) {
  if (coverUrl) {
    return (
      <div className={`relative overflow-hidden bg-night ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URLs */}
        <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  const g = GROUND[area] ?? { bg: "#3a3d5c", line: "#d6d8e8" };
  const bays = BAYS[roomType];
  const w = 240 / bays;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: g.bg }}>
      <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <g fill="none" stroke={g.line} strokeWidth="2" strokeLinejoin="round" opacity="0.55">
          <path d="M28 74 160 30l132 44" />
          <path d="M40 70v70h240V70" />
          {Array.from({ length: bays }, (_, i) => {
            const x = 40 + i * w;
            const door = i === Math.floor(bays / 2);
            return door
              ? <rect key={i} x={x + w / 2 - 11} y="96" width="22" height="44" rx="2" />
              : <rect key={i} x={x + w / 2 - 12} y="88" width="24" height="22" rx="2" />;
          })}
          <path d="M-600 140h1520" />
        </g>
      </svg>
      {label && (
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-night/70 px-2 py-0.5 text-[11px] font-medium text-white">
          {ROOM_TYPE_LABEL[roomType]}. Photos after scout visit
        </span>
      )}
    </div>
  );
}
