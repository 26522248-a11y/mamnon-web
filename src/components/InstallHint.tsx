"use client";
import { useEffect, useState } from "react";
const KEY = "installHintDismissed";
/** Gợi ý thêm vào Màn hình chính cho iPhone/iPad dùng Safari (chưa mở dạng ứng dụng). Ẩn vĩnh viễn khi bấm Đóng. */
export function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => { try {
    const ua = navigator.userAgent; const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Zalo/i.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setShow(ios && safari && !standalone && localStorage.getItem(KEY) !== "1") } catch { /* bỏ qua */ } }, []);
  if (!show) return null;
  return <div className="card relative border-l-4 border-sky-500 bg-sky-100/60 text-sm" role="note" data-testid="install-hint">
    <button className="absolute right-1 top-1 h-12 w-12 text-lg text-ink-500" aria-label="Đóng" data-testid="install-hint-close" onClick={() => { try { localStorage.setItem(KEY, "1") } catch { /* */ } setShow(false) }}>✕</button>
    <b className="block pr-10">📲 Cài ứng dụng lên iPhone</b>
    <p className="mt-1 pr-6">Bấm nút <b>Chia sẻ</b> <span aria-hidden>⬆️</span> ở thanh dưới Safari, rồi chọn <b>Thêm vào Màn hình chính</b>. Lần sau mở từ biểu tượng trên màn hình để xem nhanh tình hình của bé và nhận thông báo.</p></div>;
}
