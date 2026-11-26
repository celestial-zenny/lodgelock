import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getViewer, isLister, type Viewer } from "@/lib/auth/viewer";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icons";
import { btn } from "@/components/ui";
import { SideNav, TabBar, type NavItem } from "./nav";

const STUDENT_NAV: NavItem[] = [
  { href: "/lodges", label: "Lodges", icon: "lodges", match: ["/lodges"] },
  { href: "/bookings", label: "Bookings", icon: "bookings", match: ["/bookings"] },
  { href: "/account", label: "Account", icon: "account", match: ["/account", "/verify", "/admin", "/login", "/signup"] },
];

const LISTER_NAV: NavItem[] = [
  { href: "/landlord", label: "Dashboard", icon: "dashboard", match: ["/landlord", "/bookings"], exclude: ["/landlord/listings"] },
  { href: "/landlord/listings", label: "Listings", icon: "listings", match: ["/landlord/listings"] },
  { href: "/account", label: "Account", icon: "account", match: ["/account", "/verify"] },
];

function navFor(viewer: Viewer): NavItem[] {
  return viewer.signedIn && isLister(viewer.role) ? LISTER_NAV : STUDENT_NAV;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col px-4 py-5">
        <Link href="/" aria-label="LodgeLock home" className="rounded-lg px-2"><Logo /></Link>
        <div className="mt-8 flex-1">
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav />
          </Suspense>
        </div>
        <TrustNote />
        <Suspense fallback={null}>
          <SidebarFooter />
        </Suspense>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" aria-label="LodgeLock home" className="rounded-lg lg:invisible"><Logo markClassName="size-7" /></Link>
            <Suspense fallback={<span className="h-9 w-24" aria-hidden />}>
              <TopBarAuth />
            </Suspense>
          </div>
        </header>
        {children}
        <footer className="hidden border-t border-line px-6 py-5 text-sm text-muted lg:block">
          LodgeLock prototype. <Link href="/privacy" className="underline underline-offset-2 hover:text-brand">Privacy &amp; Terms</Link>
        </footer>
      </div>

      <Suspense fallback={<TabBarSkeleton />}>
        <MobileTabs />
      </Suspense>
    </div>
  );
}

async function MobileTabs() {
  return <TabBar items={navFor(await getViewer())} />;
}

async function SidebarNav() {
  return <SideNav items={navFor(await getViewer())} />;
}

async function SidebarFooter() {
  const viewer = await getViewer();
  if (!viewer.signedIn) {
    return (
      <div className="mt-4 grid gap-2 border-t border-line pt-4">
        <Link href="/signup" className={btn.primary}>Sign up</Link>
        <Link href="/login" className={btn.secondary}>Log in</Link>
      </div>
    );
  }
  return (
    <form action={signOut} className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
      <span className="min-w-0 truncate text-sm">
        <span className="block font-semibold">{viewer.firstName ?? "Your account"}</span>
        <span className="block capitalize text-muted">{viewer.role}</span>
      </span>
      <button className={btn.ghost}><Icon name="logout" width={18} height={18} />Log out</button>
    </form>
  );
}

async function TopBarAuth() {
  const viewer = await getViewer();
  if (!viewer.signedIn) {
    return (
      <div className="flex items-center gap-1.5">
        <Link href="/login" className={btn.ghost}>Log in</Link>
        <Link href="/signup" className={`${btn.small} bg-brand text-brand-ink hover:bg-brand-hover`}>Sign up</Link>
      </div>
    );
  }
  const initial = (viewer.firstName ?? "?").charAt(0).toUpperCase();
  return (
    <Link href="/account" aria-label="Your account"
      className="grid size-9 place-items-center rounded-full bg-night font-display text-base font-bold text-brass lg:hidden">
      {initial}
    </Link>
  );
}

function TrustNote() {
  return (
    <div className="rounded-2xl bg-night p-4 text-sm text-night-muted">
      <p className="flex items-center gap-2 font-semibold text-white"><Icon name="lock" className="text-brass" />Rent held, not handed over</p>
      <p className="mt-1.5 leading-snug">Landlords are paid only after you get the keys and confirm.</p>
    </div>
  );
}

function NavSkeleton() {
  return <div className="space-y-2" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="skeleton h-11" />)}</div>;
}

function TabBarSkeleton() {
  return <div aria-hidden className="fixed inset-x-0 bottom-0 z-30 h-[var(--tabbar-h)] border-t border-line bg-surface lg:hidden" />;
}
