import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// Self-hosted (NDPA: no third-party font requests). Both OFL, licences in ./fonts.
// Geologica sets the interface; Noto Serif Display sets headlines and money. Their latin files carry no naira sign,
// so each has a one-glyph companion (₦ only) listed second in the font stack; it loads only when a page shows a price.
const geologica = localFont({
  src: "./fonts/Geologica-Latin.woff2",
  variable: "--font-geologica",
  weight: "100 900",
  display: "swap",
});
const geologicaNaira = localFont({
  src: "./fonts/Geologica-Naira.woff2",
  variable: "--font-geologica-naira",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const engraved = localFont({
  src: "./fonts/NotoSerifDisplay-Latin.woff2",
  variable: "--font-engraved",
  weight: "100 900",
  display: "swap",
});
const engravedNaira = localFont({
  src: "./fonts/NotoSerifDisplay-Naira.woff2",
  variable: "--font-engraved-naira",
  weight: "100 900",
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
  themeColor: "#17493d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${geologica.variable} ${geologicaNaira.variable} ${engraved.variable} ${engravedNaira.variable} antialiased`}>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
