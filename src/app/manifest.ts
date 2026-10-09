import type { MetadataRoute } from "next";
// Phục vụ tại /manifest.webmanifest (Next tự chèn <link rel="manifest">). Tên lấy từ GET /settings/school lúc chạy, lỗi thì dùng tên chung.
export const dynamic = "force-dynamic";
const API = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001") + "/api/v1";
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "Quản lý mầm non";
  try { const r = await fetch(API + "/settings/school", { cache: "no-store", signal: AbortSignal.timeout(2000) }); if (r.ok) { const s = await r.json(); if (s?.name) name = s.name } } catch { /* dùng tên chung */ }
  const short = name.replace(/^Trường\s+/i, "").slice(0, 24);
  return {
    name, short_name: short, description: "Điểm danh, đón bé, học phí, thông báo cho phụ huynh và nhà trường", lang: "vi", dir: "ltr",
    start_url: "/today", scope: "/", display: "standalone", orientation: "portrait", background_color: "#FFFCF7", theme_color: "#2EBF91",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  };
}
