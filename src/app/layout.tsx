import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "俺様先生 · Ore-Sama Sensei",
  description: "A personal Japanese tutor for JLPT N2–N1 that remembers everything you learn.",
  // Installed-as-web-app (iOS "Add to Home Screen") behavior. The manifest link
  // is injected automatically by app/manifest.ts; this adds the Apple-specific
  // meta so the app launches standalone with the right title.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "俺様先生",
  },
};

// Without an explicit viewport the app rendered "zoomed in" on iOS. device-width
// + initial-scale 1 fixes the scale; viewport-fit cover lets us paint edge-to-edge
// and handle the notch/home-indicator via env(safe-area-inset-*) in the layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
