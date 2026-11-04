import type { Enums } from "@/lib/supabase/database.types";

// Placeholder until scouts upload real photos to Supabase Storage. Deliberately not a stock photo,
// so students never mistake it for the actual room.
const TINT: Record<string, string> = {
  Eziobodo: "from-emerald-700 to-emerald-500",
  Umuchima: "from-teal-700 to-sky-600",
  Ihiagwa: "from-lime-700 to-emerald-600",
};
const ICON: Record<Enums<"room_type">, string> = {
  single_room: "🛏",
  self_contain: "🚪",
  room_and_parlour: "🛋",
  flat: "🏠",
};

export function LodgeVisual({ area, roomType, className = "" }: { area: string; roomType: Enums<"room_type">; className?: string }) {
  return (
    <div className={`relative grid place-items-center bg-gradient-to-br ${TINT[area] ?? "from-zinc-600 to-zinc-400"} ${className}`}>
      <span aria-hidden className="text-4xl opacity-90">{ICON[roomType]}</span>
      <span className="absolute bottom-2 left-2 rounded bg-black/35 px-1.5 py-0.5 text-[11px] text-white">
        Photos coming after scout visit
      </span>
    </div>
  );
}
