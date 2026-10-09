"use client";
import { useState } from "react"; import { http } from "@/lib/api";
export type PickupReq = { parent?: { status: string } | null; school?: { status: string } | null; needsMyAction?: boolean; id: string; attendanceId: string; childId: string; childName: string; pickerName: string; pickerPhone: string; relation?: string; note?: string; status: "pending" | "approved" | "rejected" | "expired"; decidedByName?: string; createdAt?: string };
export const REQ_STYLE: Record<string, [string, string]> = { pending: ["bg-sun-100 text-ink-900", "⏳ Chờ xác nhận"], approved: ["bg-mint-100 text-mint-700", "✅ Đã xác nhận"], rejected: ["bg-rose-100 text-rose-500", "⛔ Không được đón"], expired: ["bg-ink-100 text-ink-500", "Hết hạn"] };
export function ReqCard({ r, onChange, canDecide, requireNote }: { r: PickupReq; onChange: () => void; canDecide: boolean; requireNote?: boolean }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const act = async (a: "confirm" | "reject") => { if (requireNote && !note.trim()) { setErr("Vui lòng ghi chú, ví dụ: đã gọi điện xác nhận với mẹ bé"); return } setBusy(true); setErr(""); try { await http.post(`/pickup-requests/${r.id}/${a}`, note.trim() ? { note: note.trim() } : {}); onChange() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  const [cls, label] = REQ_STYLE[r.status] ?? REQ_STYLE.expired;
  return <div className="card space-y-2">
    <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{r.pickerName} {r.relation && <span className="font-normal text-ink-500">({r.relation})</span>}</div>
      <div className="text-sm text-ink-500">Giao bé {r.childName} · <a className="underline" href={`tel:${r.pickerPhone}`}>{r.pickerPhone}</a></div>{r.note && <div className="text-sm">“{r.note}”</div>}</div>
      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span></div>
    {canDecide && r.status === "pending" && requireNote && <input className="input" placeholder="Ghi chú xác nhận (bắt buộc với Ban giám hiệu)" value={note} onChange={e => setNote(e.target.value)} />}
    {canDecide && r.status === "pending" && <div className="flex gap-2"><button className="btn flex-1" disabled={busy} onClick={() => act("confirm")}>Xác nhận cho đón</button>
      <button className="btn flex-1 !bg-rose-500 disabled:!bg-ink-100" disabled={busy} onClick={() => act("reject")}>Từ chối</button></div>}
    {err && <p className="text-sm text-rose-500">{err}</p>}</div>;
}
export type PickupInfo = { pickedUpByName?: string | null; relation?: string | null; pickedUpAt?: string | null } | null | undefined;
/** Dòng trạng thái đón bé. Phụ huynh đã xác nhận + trường chưa duyệt → vàng "Chờ nhà trường duyệt" (PH không phải làm gì; sun-100/ink-700, không đỏ).
 *  Còn chờ phụ huynh → thẻ đỏ PickupConfirmCard lo (dòng vàng chung như cũ). Chỉ hiện "Đã được X đón" khi có bản ghi đón thật. */
type LineReq = { status: string; pickerName: string; relation?: string | null; parent?: { status: string } | null; school?: { status: string } | null };
export function PickupLine({ pickup, reqs, card }: { pickup: PickupInfo; reqs: LineReq[]; card?: boolean }) {
  const pend = reqs.filter(r => r.status === "pending");
  const schoolWait = pend.find(r => r.parent?.status === "approved" && r.school?.status === "pending");
  const pending = pend.find(r => r !== schoolWait) ?? schoolWait;
  const base = card ? "rounded-2xl p-4" : "mt-1 inline-block rounded-full px-3 py-1 text-sm";
  const who = (r: LineReq) => r.pickerName ? <>: <b>{r.pickerName}</b>{r.relation ? ` (${r.relation})` : ""}</> : null;
  if (pending && pending === schoolWait) return <div className={`${base} bg-sun-100 text-ink-700`} data-testid="pickup-school-pending">⏳ Chờ nhà trường duyệt người đón{who(pending)}</div>;
  if (pending) return <div className={`${base} bg-sun-100 text-ink-900`} data-testid="pickup-pending">⏳ Đang chờ xác nhận người đón{who(pending)}</div>;
  if (pickup?.pickedUpAt) { const t = new Date(pickup.pickedUpAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
    const who = pickup.pickedUpByName?.trim();
    return <div className={`${base} bg-mint-100 text-mint-700`} data-testid="pickup-done">🏠 {who ? <>Đã được <b>{who}</b>{pickup.relation ? ` (${pickup.relation})` : ""} đón</> : "Bé đã được đón"} lúc {t}</div> }
  return null;
}
