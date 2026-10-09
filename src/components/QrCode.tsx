"use client";
/** Renders an EMVCo/VietQR payload string as a QR image (client-side, no network). Exposes a PNG data URL for "Lưu mã QR". */
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

export function qrSvg(payload: string, margin = 2) {
  const q = qrcode(0, "M"); q.addData(payload, "Byte"); q.make(); const n = q.getModuleCount(); const size = n + margin * 2;
  let d = ""; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
/** SVG → PNG data URL (for download / sharing to banking apps that only accept images). */
export function svgToPng(svg: string, px = 720): Promise<string> {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = px;
    const g = c.getContext("2d"); if (!g) return rej(new Error("canvas")); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px); res(c.toDataURL("image/png")) };
    img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) });
}
export function QrCode({ payload, className = "", alt, onPng }: { payload: string; className?: string; alt: string; onPng?: (png: string | null) => void }) {
  const svg = useMemo(() => { try { return qrSvg(payload) } catch { return null } }, [payload]);
  const [, setPng] = useState<string | null>(null);
  useEffect(() => { if (!svg || !onPng) return; let live = true; svgToPng(svg).then(p => { if (live) { setPng(p); onPng(p) } }).catch(() => onPng(null)); return () => { live = false } }, [svg, onPng]);
  if (!svg) return <div className={`flex items-center justify-center rounded-xl bg-ink-100 text-sm text-ink-500 ${className}`}>Không tạo được mã QR</div>;
  return <div role="img" aria-label={alt} className={`overflow-hidden rounded-xl bg-white ${className}`} data-testid="qr-image" dangerouslySetInnerHTML={{ __html: svg }} />;
}
