// Shared class strings so every button and surface reads the same. Plain strings: usable from server and client.

const btnBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const btn = {
  primary: `${btnBase} bg-brand text-brand-ink hover:bg-brand-hover`,
  secondary: `${btnBase} border border-line-strong/50 bg-surface text-ink hover:border-brand hover:text-brand`,
  danger: `${btnBase} border border-signal text-signal hover:bg-signal-soft`,
  dangerSolid: `${btnBase} bg-signal text-white hover:bg-[#931c13]`,
  ghost: "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-brand-soft hover:text-brand",
  small:
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:opacity-60",
} as const;

export const card = "rounded-2xl border border-line bg-surface";
export const pageTitle = "font-display text-3xl font-extrabold leading-[1.05] text-ink sm:text-4xl";
export const sectionTitle = "font-display text-xl font-bold text-ink";
export const page = "mx-auto w-full flex-1 px-4 pt-5 sm:px-6 lg:pt-8 pb-tabbar";
