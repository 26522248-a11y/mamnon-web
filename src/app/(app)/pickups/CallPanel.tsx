"use client";
/** Screen 4 – after 15 minutes without the parent's answer: call ① then ② (tel:) and log each outcome. Never auto-approves. */
import { useState } from "react";
import { CallOutcome, Escalation, logCall, OUTCOME_TEXT, PHONE_SOURCE_TEXT, pickupErrorText, PickupRequest } from "@/lib/pickup-api";
import { hhmm, mmss, useMsLeft } from "@/components/pickup-safety";

const OUTCOMES: CallOutcome[] = ["no_answer", "busy", "wrong_number", "confirmed", "rejected", "other"];
export function CallPanel({ r, onChange }: { r: PickupRequest; onChange: (r: PickupRequest) => void }) {
  const e = r.escalation as Escalation | undefined; const left = useMsLeft(e?.dueAt);
  const [phone, setPhone] = useState<string>(""); const [outcome, setOutcome] = useState<CallOutcome | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  if (!e || r.status !== "pending" || r.parent.status !== "pending") return null;
  if (!e.due && !e.callAttempts.length) return <div className="rounded-2xl bg-sun-100 p-3 text-sm" data-testid="call-wait">⏳ Chờ phụ huynh xác nhận trên app · còn {mmss(left)} thì gọi điện cho phụ huynh</div>;
  const chosen = phone || e.nextPhone?.phone || e.phones[0]?.phone || "";
  const save = async () => { setErr(""); setMsg("");
    if (!chosen) return setErr("Chọn số đã gọi"); if (!outcome) return setErr("Chọn kết quả cuộc gọi");
    if ((outcome === "confirmed" || outcome === "rejected" || outcome === "other") && !note.trim()) return setErr("Ghi rõ đã nói chuyện với ai, nội dung gì (bắt buộc)");
    setBusy(true);
    try { const g = e.phones.find(p => p.phone === chosen);
      const nr = await logCall(r.id, { phone: chosen, outcome, guardianId: g?.guardianId ?? undefined, note: note.trim() || undefined }); onChange(nr);
      setMsg(outcome === "confirmed" ? "Đã ghi nhận. Chuyển Ban giám hiệu / trực đón xác nhận thay phụ huynh, chưa giao bé." : "Đã ghi nhận cuộc gọi.");
      setOutcome(null); setNote("") } catch (x) { setErr(pickupErrorText(x)) } finally { setBusy(false) } };
  return <div className="space-y-3" data-testid="call-panel">
    <div className="rounded-2xl bg-rose-100 p-4 text-center"><div className="text-3xl">⏰</div><b className="text-lg text-rose-500">Quá {e.afterMinutes} phút chưa có phản hồi</b>
      <p className="text-sm">Hãy gọi cho phụ huynh theo thứ tự. <b>Không giao bé</b> khi chưa có xác nhận.</p></div>
    {e.phones.map((p, j) => <a key={p.phone} href={p.tel} data-testid={`call-${p.order}`} onClick={() => setPhone(p.phone)}
      className={`flex min-h-14 items-center justify-between rounded-2xl px-4 py-2 ${j === 0 ? "bg-mint-500 text-white" : "border-2 border-mint-500 text-mint-700"}`}>
      <span><b>{p.order === 1 ? "①" : "②"} {[p.relation, p.name].filter(Boolean).join(" ") || "Số liên hệ phụ huynh"}</b><span className="block text-sm">{p.phone}{e.nextPhone?.phone === p.phone && " · gọi số này"}</span>{p.source && <span className="block text-xs opacity-80" data-testid={`call-source-${p.order}`}>{PHONE_SOURCE_TEXT[p.source] ?? p.source}</span>}</span><span className="text-2xl">📞</span></a>)}
    {!e.phones.length && <p className="text-sm text-rose-500">Bé chưa có số điện thoại phụ huynh. Báo Ban giám hiệu ngay.</p>}
    <div className="card space-y-2" data-testid="call-log"><b className="text-sm">Kết quả cuộc gọi</b>
      {e.phones.length > 1 && <div className="flex gap-2">{e.phones.map(p => <button key={p.phone} type="button" onClick={() => setPhone(p.phone)}
        className={`min-h-12 flex-1 rounded-xl text-sm ${chosen === p.phone ? "bg-ink-900 text-white" : "bg-ink-100"}`}>{p.order === 1 ? "①" : "②"} {p.phone}</button>)}</div>}
      <div className="grid grid-cols-2 gap-2">{OUTCOMES.map(o => <button key={o} type="button" data-testid={`outcome-${o}`} onClick={() => setOutcome(o)}
        className={`min-h-12 rounded-xl text-sm ${outcome === o ? (o === "confirmed" ? "bg-mint-500 text-white" : o === "rejected" ? "bg-rose-500 text-white" : "bg-ink-900 text-white") : "bg-ink-100"}`}>{OUTCOME_TEXT[o]}</button>)}</div>
      {outcome && <input className="input" value={note} onChange={x => setNote(x.target.value)} maxLength={500} data-testid="call-note"
        placeholder={outcome === "confirmed" ? "Bắt buộc: nói chuyện với ai, đồng ý thế nào" : "Ghi chú"} />}
      <p className="text-xs text-ink-500">“PH đồng ý qua ĐT” chuyển cho Ban giám hiệu / trực đón xác nhận thay, bắt buộc ghi chú. Ghi nhận cuộc gọi không tự giao bé.</p>
      {err && <p className="text-sm text-rose-500">{err}</p>}{msg && <p className="text-sm text-mint-700" data-testid="call-msg">{msg}</p>}
      <button className="btn min-h-12 w-full" disabled={busy} onClick={save} data-testid="call-save">Lưu kết quả</button>
      {e.callAttempts.map(a => <div key={a.id} className="border-t border-ink-100 pt-1 text-xs" data-testid="call-attempt">{hhmm(a.at)} · {a.calledByName ?? ""} gọi {a.phone}: <b>{OUTCOME_TEXT[a.outcome] ?? a.outcome}</b>{a.note ? ` – ${a.note}` : ""}</div>)}</div></div>;
}
