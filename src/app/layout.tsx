import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Menora — цифровое меню для кафе и ресторанов",
    template: "%s — Menora",
  },
  description: "QR-меню, приём заказов, программа лояльности и аналитика для заведений общепита.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#c9722c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The Telegram Mini App SDK (src/app/[slug]/page.tsx) writes
      // --tg-viewport-height custom properties onto this element as soon as
      // it loads, outside React's control — without this, React logs a
      // (harmless) hydration mismatch for every visitor, Telegram or not.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
