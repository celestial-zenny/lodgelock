import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Self-hosted (NDPA: no third-party font requests). Files vendored from the `geist` package (OFL).
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LodgeLock — verified lodges for FUTO students",
  description:
    "Book verified lodges near FUTO. Your rent is held until you get the keys and confirm the lodge matches the listing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          LodgeLock prototype · <Link href="/privacy" className="underline">Privacy &amp; Terms</Link>
        </footer>
      </body>
    </html>
  );
}
