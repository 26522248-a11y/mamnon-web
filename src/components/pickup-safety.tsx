"use client";
/* eslint-disable @next/next/no-img-element -- blob/object URLs of token-protected photos; next/image cannot optimise them */
/** Shared UI for pickup-safety (đợt 1). Colors: rose = act now, sun = pending, mint = confirmed. */
import { useEffect, useState } from "react"; import { http } from "@/lib/api";
import { PushState, pushState, StepInfo, subscribePush } from "@/lib/pickup-api";

/** Large rectangular photo of the picker (token-protected URL → blob). */
export function PersonPhoto({ url, alt, className = "h-40 w-full", testid, hideMissing }: { url: string | null | undefined; alt: string; className?: string; testid?: string; /** D1: ảnh không tải được → ẩn hẳn khung thay vì "Chưa có ảnh" */ hideMissing?: boolean }) {
  const [src, setSrc] = useState<string | null>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { let u: string | null = null; let live = true; setSrc(null); setFailed(false);
    if (url) http.blobUrl(url).then(x => { u = x; if (live) { if (x) setSrc(x); else setFailed(true) } }).catch(() => live && setFailed(true));
    return () => { live = false; if (u) URL.revokeObjectURL(u) } }, [url]);
  if (hideMissing && (!url || failed)) return null;
  return <div data-testid={testid} className={`flex items-center justify-center overflow-hidden rounded-2xl bg-ink-100 ${className}`}>
    {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <span className="text-center text-sm text-ink-500">{!url || failed ? <>🧑<br />Chưa có ảnh</> : "Đang tải ảnh…"}</span>}</div>;
}

/** Local preview of a picked photo; HEIC can't be shown by most browsers → text instead (file is still uploaded as-is). */
export function PreviewImg({ src, className = "h-40 w-full object-cover" }: { src: string; className?: string }) {
  const [bad, setBad] = useState(false); useEffect(() => setBad(false), [src]);
  return bad ? <span className="p-4 text-center text-sm" data-testid="photo-picked">✅ Đã chọn ảnh (không xem trước được trên trình duyệt này)</span>
    : <img src={src} alt="Ảnh người đón" className={className} onError={() => setBad(true)} />;
}

/** Ticks every second; returns ms left (≤0 when passed). */
export function useMsLeft(target: string | Date | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, []);
  return target ? new Date(target).getTime() - now : Infinity;
}
export const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` };
export const hhmm = (d?: string | null) => (d ? new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "");

/** One approval step row with a tick (screen 3). */
export function StepTick({ label, s, testid }: { label: string; s: StepInfo; testid: string }) {
  const ok = s.status === "approved", bad = s.status === "rejected";
  return <div data-testid={testid} data-status={s.status} className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2 ${ok ? "bg-mint-100" : bad ? "bg-rose-100" : "bg-sun-100"}`}>
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${ok ? "bg-mint-500 text-white" : bad ? "bg-rose-500 text-white" : "bg-white"}`}>{ok ? "✓" : bad ? "✕" : "⏳"}</span>
    <div className="text-sm"><b>{label}</b> · {ok ? `${s.decidedByName ?? ""} đã xác nhận ${hhmm(s.decidedAt)}` : bad ? `${s.decidedByName ?? ""} TỪ CHỐI${s.note ? ": " + s.note : ""}` : "đang chờ"}</div></div>;
}

/** Reason field with preset suggestions; required (reject). */
export function ReasonBox({ presets, onSubmit, onCancel, busy, label = "Từ chối cần lý do", cta = "Xác nhận từ chối", testid = "reject-reason" }:
  { presets: string[]; onSubmit: (note: string) => void; onCancel: () => void; busy?: boolean; label?: string; cta?: string; testid?: string }) {
  const [v, setV] = useState(""); const [err, setErr] = useState("");
  return <div className="space-y-2 rounded-2xl bg-rose-100 p-3" data-testid={testid}>
    <b className="text-sm">{label}</b>
    <textarea className="input min-h-20" placeholder="Lý do (bắt buộc)…" value={v} maxLength={500} onChange={e => { setV(e.target.value); setErr("") }} data-testid={`${testid}-input`} />
    <div className="flex flex-wrap gap-2">{presets.map(p => <button key={p} type="button" onClick={() => setV(p === "Khác" ? "" : p)} className="min-h-12 rounded-full bg-white px-3 text-sm">{p}</button>)}</div>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <div className="flex gap-2"><button type="button" className="btn min-h-12 flex-1 !bg-rose-500 disabled:!bg-ink-100" disabled={busy} data-testid={`${testid}-submit`}
      onClick={() => (v.trim() ? onSubmit(v.trim()) : setErr("Vui lòng nhập hoặc chọn lý do"))}>{cta}</button>
      <button type="button" className="btn min-h-12 flex-1 !bg-ink-300" onClick={onCancel}>Hủy</button></div></div>;
}

/** "Bật thông báo đón bé": subscribe to Web Push via GET /push/vapid-public-key + POST /push/subscriptions. */
export function PushOptIn() {
  const [st, setSt] = useState<PushState | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [hid, setHid] = useState(false);
  useEffect(() => { setHid(localStorage.getItem("pushDeniedHidden") === "1") }, []);
  useEffect(() => { pushState().then(setSt).catch(() => setSt("unsupported")) }, []);
  if (!st || st === "subscribed" || st === "disabled" || st === "unsupported") return null;
  if (st === "denied") return hid ? null : <div className="flex items-start gap-2 rounded-2xl bg-sun-100 p-3 text-sm" data-testid="push-denied"><p className="flex-1">🔕 Điện thoại đang tắt thông báo của app. Khi có người đến đón con, bạn sẽ không nhận được tin báo ngay. Muốn bật lại: vào Cài đặt của trình duyệt, chọn Thông báo, rồi cho phép trang này.</p><button className="min-h-12 shrink-0 rounded-xl bg-white px-4 font-semibold" data-testid="push-denied-hide" onClick={() => { localStorage.setItem("pushDeniedHidden", "1"); setHid(true) }}>Ẩn</button></div>;
  return <div className="card flex items-center justify-between gap-3 border-l-4 border-sun-500" data-testid="push-optin">
    <span className="text-sm">🔔 Bật thông báo để xác nhận ngay khi có người đến đón bé{err && <span className="block text-rose-500">{err}</span>}</span>
    <button className="btn min-h-12 shrink-0" disabled={busy} data-testid="push-enable" onClick={async () => { setBusy(true); setErr("");
      try { setSt(await subscribePush()) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }}>Bật</button></div>;
}
