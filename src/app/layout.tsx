import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// Self-hosted (NDPA: no third-party font requests). Bricolage Grotesque, OFL (see fonts/BricolageGrotesque-OFL.txt).
// Variable axes: optical size, weight and width. Two subsets: the latin-ext file carries the naira sign (₦) and is
// listed second in the font stack, so browsers only fetch it when a page needs those glyphs.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

const bricolageExt = localFont({
  src: "./fonts/BricolageGrotesque-LatinExt.woff2",
  variable: "--font-bricolage-ext",
  weight: "200 800",
  display: "swap",
  preload: false,
});

const description =
  "Book verified lodges near FUTO. Your rent is held until you get the keys and confirm the lodge matches the listing.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "LodgeLock: verified lodges for FUTO students", template: "%s · LodgeLock" },
  description,
  applicationName: "LodgeLock",
  appleWebApp: { capable: true, title: "LodgeLock", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "LodgeLock",
    title: "LodgeLock: your rent stays locked until you get the keys",
    description,
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2c2f86",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${bricolage.variable} ${bricolageExt.variable} antialiased`}>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
