import "./globals.css"; import "./print.css"; import { Be_Vietnam_Pro } from "next/font/google"; import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/SwRegister";
const font = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["400", "500", "600", "700"], display: "swap" });
export const metadata: Metadata = {
  title: "Quản lý học sinh mầm non", applicationName: "Quản lý mầm non", manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
  appleWebApp: { capable: true, title: "Mầm non", statusBarStyle: "default" }, formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2EBF91" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body className={`${font.className} bg-cream text-ink-900 antialiased`}>{children}<SwRegister /></body></html>;
}
