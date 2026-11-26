import { useId } from "react";
import type { Enums } from "@/lib/supabase/database.types";
import { ROOM_TYPE_LABEL } from "@/lib/listing";

// Placeholder until a lodge has real photos: an engraved elevation, deliberately not a stock photo, so students
// never mistake it for the actual room. Drawn the way a note is printed: line carries the form, hatching carries
// the tone. Each area has its own ink.
const INK: Record<string, { bg: string; line: string }> = {
  Eziobodo: { bg: "#17493d", line: "#cfe0d7" },
  Umuchima: { bg: "#1f3d5c", line: "#d2deea" },
  Ihiagwa: { bg: "#4a2c45", line: "#e6d3e1" },
};

// Window count hints at the room type: more frontage for smaller rooms in a block, fewer for flats.
const BAYS: Record<Enums<"room_type">, number> = { single_room: 5, self_contain: 4, room_and_parlour: 3, flat: 2 };

export function LodgeVisual({ area, roomType, coverUrl, className = "", label = true }: {
  area: string;
  roomType: Enums<"room_type">;
  coverUrl?: string | null;
  className?: string;
  label?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (coverUrl) {
    return (
      <div className={`relative overflow-hidden bg-night ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URLs */}
        <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  const ink = INK[area] ?? { bg: "#2f3d38", line: "#d6ded9" };
  const bays = BAYS[roomType];
  const w = 240 / bays;
  const roof = "M28 74 160 30l132 44z";
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: ink.bg }}>
      <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <pattern id={`roof${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="4" stroke={ink.line} strokeWidth="0.7" />
          </pattern>
          <pattern id={`wall${id}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={ink.line} strokeWidth="0.35" />
          </pattern>
          <clipPath id={`roofclip${id}`}><path d={roof} /></clipPath>
        </defs>
        <g opacity="0.75" stroke={ink.line} fill="none" strokeLinejoin="round">
          <rect x="40" y="70" width="240" height="70" fill={`url(#wall${id})`} stroke="none" opacity="0.6" />
          <rect x="0" y="0" width="320" height="160" fill={`url(#roof${id})`} stroke="none" clipPath={`url(#roofclip${id})`} opacity="0.85" />
          <path d={roof} strokeWidth="1.3" />
          <path d="M40 70v70h240V70" strokeWidth="1.3" />
          {Array.from({ length: bays }, (_, i) => {
            const x = 40 + i * w;
            const door = i === Math.floor(bays / 2);
            return door
              ? <rect key={i} x={x + w / 2 - 11} y="96" width="22" height="44" rx="1.5" fill={ink.bg} strokeWidth="1.1" />
              : <rect key={i} x={x + w / 2 - 12} y="88" width="24" height="22" rx="1.5" fill={ink.bg} strokeWidth="1.1" />;
          })}
          <path d="M-600 140h1520" strokeWidth="1" />
        </g>
      </svg>
      {label && (
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
          {ROOM_TYPE_LABEL[roomType]}. Photos after scout visit
        </span>
      )}
    </div>
  );
}
