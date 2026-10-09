"use client";
import { useEffect, useState } from "react"; import { http } from "@/lib/api";
/** Avatar con vật cố định theo id bé (avatar-01..10). */
export function avatarFor(id?: string | null) {
  let h = 0; for (const ch of id ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `/avatars/avatar-${String((h % 10) + 1).padStart(2, "0")}.png`;
}
export function WithdrawnBadge({ className = "" }: { className?: string }) {
  return <span data-testid="badge-withdrawn" className={`inline-block rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-500 ${className}`}>Đã nghỉ</span>;
}
/** noConsent: photoConsent === false → small 🚫 badge. Used ONLY on child detail (profile).
 *  TODO(wave 3 photo/album screen): invert — mark children who ARE allowed (photoConsent === true), not the ones who are not. */
export function Photo({ url, id, withdrawn, size = 64, noConsent }: { url?: string | null; id?: string; gender?: string; withdrawn?: boolean; size?: number; noConsent?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let u: string | null = null; let live = true; setSrc(null);
    if (url) http.blobUrl(url).then(s => { u = s; if (live) setSrc(s) }).catch(() => {});
    return () => { live = false; if (u) URL.revokeObjectURL(u) } }, [url]);
  const img = <div style={{ width: size, height: size }} data-testid="child-photo" title={withdrawn ? "Đã nghỉ" : undefined}
    className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-peach-100 ${withdrawn ? "opacity-50 grayscale" : ""}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src ?? avatarFor(id)} alt="" className="h-full w-full object-cover" onError={() => setSrc(null)} /></div>;
  if (!noConsent) return img;
  return <div className="relative shrink-0" style={{ width: size, height: size }}>{img}
    <span data-testid="badge-no-consent" title="Chưa đồng ý đăng ảnh" aria-label="Chưa đồng ý đăng ảnh"
      className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] shadow">🚫</span></div>;
}
