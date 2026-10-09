"use client";
import { useEffect } from "react"; import { SW_URL } from "@/lib/pickup-api";
/** Đăng ký /sw.js chỉ ở bản production (dev không đăng ký để tránh cache lẫn lộn khi phát triển). */
export function SwRegister() {
  useEffect(() => { if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {}) }, []);
  return null;
}
