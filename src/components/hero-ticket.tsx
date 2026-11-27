"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { RentTrack } from "@/components/rent-track";
import { Note } from "@/components/note";

gsap.registerPlugin(useGSAP);

/**
 * The home page's one authored moment: an example held note "prints". The rosette's linework spreads out from
 * its centre, the security thread weaves in from the top, and the track locks from Booked to Rent held. All of it is
 * visible in the server-rendered state; the animation only plays it in, and is skipped for reduced motion.
 */
export function HeroTicket({ title, place, total, breakdown }: {
  title: string;
  place: string;
  total: string;
  breakdown: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.1 });
      tl.from("[data-note]", { y: 12, duration: 0.7 })
        .fromTo("[data-rosette]", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(71% at 50% 50%)", duration: 1.2, ease: "power2.out" }, 0)
        .fromTo("[data-foil]", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "power2.out" }, 0.3)
        .from('[data-step="1"] [data-bar]', { scaleX: 0, duration: 0.5, ease: "power2.inOut" }, 0.3)
        .from('[data-step="1"] [data-dot]', { scale: 0.55, duration: 0.45 }, 0.65)
        .from("[data-shackle]", { y: -3.5, duration: 0.35, ease: "back.out(2)" }, 0.85)
        .from("[data-held]", { scale: 0.9, duration: 0.35 }, 0.85);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root}>
      <Note serial="No. LL 0001 EZB">
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-night-muted">{place}</p>
          </div>
          <span data-held className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brass px-3 py-1 text-xs font-semibold text-night">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
              <path data-shackle d="M7.5 11V8.2L12 4.5l4.5 3.7V11" />
              <rect x="5" y="11" width="14" height="9" rx="2" />
            </svg>
            Rent held
          </span>
        </div>
        <p className="mt-9 text-sm text-night-muted">Held for you</p>
        <p className="font-display text-[3.25rem] leading-none font-medium tnum sm:text-[4rem]">{total}</p>
        <p className="mt-2 text-sm text-night-muted">{breakdown}</p>
        <span aria-hidden className="print-band my-6 block h-5 text-brass/45" />
        <RentTrack current={1} dark />
        <p className="mt-6 text-sm text-night-muted">The landlord is paid after you collect the keys and confirm.</p>
      </Note>
    </div>
  );
}
