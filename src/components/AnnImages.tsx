/* eslint-disable @next/next/no-img-element -- ảnh là blob URL có xác thực, next/image không dùng được */
"use client";
import { useEffect, useRef, useState } from "react"; import { http } from "@/lib/api";
export type Att = { id: string; url: string; thumbUrl: string; width: number; height: number; size: number };
/** Ảnh cần token → tải thành blob URL. */
export function useBlob(url: string | null) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { let live = true, made: string | null = null; if (url) http.blobUrl(url).then(b => { made = b; if (live) setU(b); else if (b) URL.revokeObjectURL(b) }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made) } }, [url]);
  return u;
}
export function Thumb({ a, className = "", onClick }: { a: Att; className?: string; onClick?: () => void }) {
  const u = useBlob(a.thumbUrl);
  return <button type="button" onClick={onClick} className={`aspect-square overflow-hidden rounded-xl bg-ink-100 ${className}`} data-testid="ann-thumb">{u && <img src={u} alt="" className="h-full w-full object-cover" />}</button>;
}
function Big({ a }: { a: Att }) { const u = useBlob(a.url); return u ? <img src={u} alt="" className="max-h-[80vh] max-w-full select-none object-contain" draggable={false} /> : <div className="text-white">Đang tải…</div> }
export function Gallery({ items, cols = 3 }: { items: Att[]; cols?: number }) {
  const [open, setOpen] = useState<number | null>(null); const x0 = useRef<number | null>(null);
  const go = (d: number) => setOpen(i => i === null ? null : (i + d + items.length) % items.length);
  useEffect(() => { if (open === null) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1) };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k) });
  if (!items.length) return null;
  return <><div className={`grid gap-1.5 ${cols === 4 ? "grid-cols-4" : "grid-cols-3"}`} data-testid="ann-gallery">{items.map((a, i) => <Thumb key={a.id} a={a} onClick={() => setOpen(i)} />)}</div>
    {open !== null && <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90" data-testid="ann-lightbox" onClick={() => setOpen(null)}
      onTouchStart={e => { x0.current = e.touches[0].clientX }} onTouchEnd={e => { if (x0.current === null) return; const dx = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(dx) > 40) { e.preventDefault(); go(dx < 0 ? 1 : -1) } }}>
      <div onClick={e => e.stopPropagation()}><Big a={items[open]} /></div>
      <div className="mt-3 text-sm text-white">{open + 1}/{items.length} · vuốt để xem ảnh khác</div>
      {items.length > 1 && <><button className="absolute left-2 top-1/2 h-12 w-12 rounded-full bg-white/20 text-2xl text-white" onClick={e => { e.stopPropagation(); go(-1) }} aria-label="Ảnh trước">‹</button>
        <button className="absolute right-2 top-1/2 h-12 w-12 rounded-full bg-white/20 text-2xl text-white" onClick={e => { e.stopPropagation(); go(1) }} aria-label="Ảnh sau" data-testid="lb-next">›</button></>}
      <button className="absolute right-3 top-3 h-12 w-12 rounded-full bg-white/20 text-xl text-white" aria-label="Đóng">✕</button></div>}</>;
}
