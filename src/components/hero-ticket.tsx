"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { RentTrack } from "@/components/rent-track";

gsap.registerPlugin(useGSAP);

/**
 * The home page's one authored moment: an example booking "locks". The ticket settles, the track draws from
 * Booked to Rent held, the brass dot arrives and the padlock's shackle drops shut. Everything is visible in
 * the server-rendered state; the animation only plays it in, and is skipped for reduced motion.
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
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 });
      tl.from("[data-ticket]", { y: 14, duration: 0.7 })
        .from('[data-step="1"] [data-bar]', { scaleX: 0, duration: 0.5, ease: "power2.inOut" }, 0.2)
        .from('[data-step="1"] [data-dot]', { scale: 0.55, duration: 0.45 }, 0.55)
        .from("[data-shackle]", { y: -3.5, duration: 0.35, ease: "back.out(2)" }, 0.75)
        .from("[data-held]", { scale: 0.9, duration: 0.35 }, 0.75);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root}>
      <div data-ticket className="on-dark relative overflow-hidden rounded-2xl bg-night p-6 text-white shadow-[0_24px_48px_-24px_rgba(19,21,58,0.7)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-night-muted">{place}</p>
          </div>
          <span data-held className="inline-flex items-center gap-1.5 rounded-full bg-brass px-3 py-1 text-xs font-bold text-night">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
              <path data-shackle d="M7.5 11V8.2L12 4.5l4.5 3.7V11" />
              <rect x="5" y="11" width="14" height="9" rx="2" />
            </svg>
            Rent held
          </span>
        </div>
        <p className="mt-8 text-sm text-night-muted">Held for you</p>
        <p className="font-display text-5xl font-extrabold tnum sm:text-6xl">{total}</p>
        <p className="mt-1 text-sm text-night-muted">{breakdown}</p>
        <div aria-hidden className="relative my-7 border-t-2 border-dashed border-white/20">
          <span className="absolute -top-3 -left-9 size-6 rounded-full bg-paper" />
          <span className="absolute -top-3 -right-9 size-6 rounded-full bg-paper" />
        </div>
        <RentTrack current={1} dark />
        <p className="mt-6 text-sm text-night-muted">The landlord is paid after you collect the keys and confirm.</p>
      </div>
    </div>
  );
}
