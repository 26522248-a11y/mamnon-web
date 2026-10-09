"use client";
/** G6 (mockups12): xin nghỉ – 3 loại (bắt buộc), từ/đến ngày, cả ngày / buổi sáng / buổi chiều, "Tính n ngày công", ghi chú bàn giao lớp. */
import { useEffect, useState } from "react";
import { DateField } from "@/components/DateField";
import { Balance, fmtDays, Leave, leaveBalance, leavePreview, LeaveSession, LeaveType, sendLeave, SESSION_UI, TYPE_UI } from "@/lib/leave-api";

const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function LeaveForm({ onDone, onCancel }: { onDone: (l: Leave) => void; onCancel?: () => void }) {
  const [type, setType] = useState<LeaveType | null>(null); const [from, setFrom] = useState(vnToday()); const [to, setTo] = useState(vnToday());
  const [session, setSession] = useState<LeaveSession>("full"); const [note, setNote] = useState(""); const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(null); const [bal, setBal] = useState<Balance | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const multi = to > from;
  useEffect(() => { leaveBalance().then(setBal).catch(() => {}) }, []);
  useEffect(() => { if (multi && session !== "full") setSession("full") }, [multi, session]);
  useEffect(() => { if (!from || !to || to < from) return setDays(null); let live = true; leavePreview(from, to, session).then(r => live && setDays(r.days)).catch(() => live && setDays(null)); return () => { live = false } }, [from, to, session]);
  const submit = async () => { if (!type) return setErr("Chọn loại nghỉ"); setBusy(true); setErr("");
    try { onDone(await sendLeave({ type, fromDate: from, toDate: to, session, reason: reason.trim() || undefined, handoverNote: note.trim() || undefined })) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  return <div className="card space-y-3" data-testid="leave-form">
    <b className="text-lg">🏖 Xin nghỉ</b>
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Loại nghỉ">{(Object.keys(TYPE_UI) as LeaveType[]).map(t => <button key={t} type="button" role="radio" aria-checked={type === t}
      data-testid={`leave-type-${t}`} onClick={() => setType(t)}
      className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-1 text-sm font-semibold ${type === t ? TYPE_UI[t].on : "border-ink-100 bg-white"}`}>
      <span className="text-xl">{TYPE_UI[t].icon}</span>{TYPE_UI[t].label}{t === "annual" && bal && <span className="text-xs font-normal text-ink-500">còn {fmtDays(bal.annualRemaining)} ngày</span>}</button>)}</div>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs text-ink-500">Từ ngày<DateField value={from} min={vnToday()} onChange={v => { setFrom(v); if (to < v) setTo(v) }} aria-label="Từ ngày" /></label>
      <label className="text-xs text-ink-500">Đến ngày<DateField value={to} min={from} onChange={setTo} aria-label="Đến ngày" /></label></div>
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Buổi">{(["full", "morning", "afternoon"] as LeaveSession[]).map(x => <button key={x} type="button" role="radio" aria-checked={session === x}
      disabled={multi && x !== "full"} onClick={() => setSession(x)} data-testid={`leave-session-${x}`}
      className={`min-h-12 rounded-xl border text-sm font-semibold disabled:opacity-40 ${session === x ? "border-mint-500 bg-mint-500 text-white" : "border-ink-100 bg-white"}`}>{SESSION_UI[x]}</button>)}</div>
    {multi && <p className="text-xs text-ink-500">Nghỉ nửa ngày chỉ chọn được khi nghỉ 1 ngày.</p>}
    <p className="rounded-xl bg-mint-50 p-2 text-sm text-mint-700" data-testid="leave-days">Tính <b>{days === null ? "…" : fmtDays(days)}</b> ngày công{days === 0 && <span className="block text-xs">Thứ Bảy, Chủ nhật, ngày lễ không tính công</span>}</p>
    <input className="input" placeholder="Lý do (không bắt buộc)" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} aria-label="Lý do" />
    <label className="block text-sm font-medium">Ghi chú bàn giao lớp <span className="font-normal text-ink-500">(cô trông thay xem)</span>
      <textarea className="input mt-1" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="Ví dụ: bé Na dị ứng sữa; 10h lớp tập văn nghệ" data-testid="leave-handover" /></label>
    {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
    <div className="flex gap-2">{onCancel && <button className="min-h-12 flex-1 rounded-xl border border-ink-100" onClick={onCancel}>Huỷ</button>}
      <button className="btn min-h-12 flex-1" disabled={busy || !type || !from || !to} onClick={submit} data-testid="leave-submit">{busy ? "Đang gửi…" : "Gửi đơn cho Ban giám hiệu"}</button></div>
  </div>;
}
