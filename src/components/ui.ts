// Shared class strings so every button and surface reads the same. Plain strings: usable from server and client.

const btnBase =
  "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const btn = {
  primary: `${btnBase} bg-brand text-brand-ink hover:bg-brand-hover`,
  secondary: `${btnBase} border border-line-strong/50 bg-surface text-ink hover:border-brand hover:text-brand`,
  danger: `${btnBase} border border-signal text-signal hover:bg-signal-soft`,
  dangerSolid: `${btnBase} bg-signal text-white hover:bg-[#931c13]`,
  ghost: "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-brand-soft hover:text-brand",
  small:
    "press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold disabled:opacity-60",
} as const;

// Cards carry a note's double hairline: the border plus an inset second rule.
export const card = "rounded-[14px] border border-line bg-surface shadow-[inset_0_0_0_4px_var(--surface),inset_0_0_0_5px_var(--line)]";
export const pageTitle = "font-display text-[2.1rem] font-medium leading-[1.05] tracking-[-0.015em] text-ink sm:text-[2.6rem]";
export const sectionTitle = "font-display text-xl font-semibold text-ink";
export const page = "mx-auto w-full flex-1 px-4 pt-5 sm:px-6 lg:pt-8 pb-tabbar";
