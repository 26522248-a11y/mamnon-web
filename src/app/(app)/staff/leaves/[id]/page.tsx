"use client";
/** H1/G7 (mockups12): đơn nghỉ – BGH duyệt ngay tại đây (chọn cô trông thay, Từ chối / Duyệt); GV xem trạng thái + sửa ghi chú bàn giao; cô trông thay xem ghi chú. */
import Link from "next/link"; import { useParams, useSearchParams } from "next/navigation"; import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { approveLeave, dm, fmtDays, LeaveDetail, leaveDetail, leaveWhen, patchLeave, rejectLeave, STATUS_UI, TYPE_UI } from "@/lib/leave-api";

export default function LeavePage() {
  const { id } = useParams<{ id: string }>(); const sent = useSearchParams().get("sent"); const me = api.me();
  const [l, setL] = useState<LeaveDetail | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(sent ? "Đã gửi đơn, Ban giám hiệu sẽ được báo" : "");
  const [pick, setPick] = useState<string>(""); const [rejecting, setRejecting] = useState(false); const [why, setWhy] = useState(""); const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => leaveDetail(id).then(x => { setL(x); setPick(p => p || x.coverage?.find(c => !c.substitution)?.suggestions[0]?.userId || "") }).catch(e => setErr((e as Error).message)), [id]);
  useEffect(() => { load() }, [load]);
  if (err && !l) return <p className="text-rose-500" role="alert">{err}</p>;
  if (!l || !me) return <p className="text-ink-500">Đang tải…</p>;
  const admin = me.role === "admin", mine = l.userId === me.id, t = TYPE_UI[l.type], st = STATUS_UI[l.status];
  const open = (l.coverage ?? []).filter(c => !c.substitution);
  const sugg = Array.from(new Map(open.flatMap(c => c.suggestions).map(s => [s.userId, s])).values());
  const act = async (f: () => Promise<unknown>, ok: string) => { setBusy(true); setErr(""); try { await f(); setMsg(ok); setRejecting(false); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  return <div className="mx-auto max-w-md space-y-3" data-testid="leave-page">
    <Link href={admin ? "/staff" : "/home"} className="text-sm text-mint-700">‹ {admin ? "Chấm công & nghỉ phép" : "Trang đầu"}</Link>
    {msg && <p className="rounded-xl bg-mint-100 p-3 text-sm text-mint-700" role="status" data-testid="leave-msg">{msg}</p>}
    <div className={`card space-y-2 border-l-4 ${st.cls.split(" ")[0]}`} data-testid="leave-card">
      <div className="flex items-start justify-between gap-2"><div><b className="text-lg">{l.userName}</b>{l.classes.length > 0 && <p className="text-sm text-ink-500">Lớp {l.classes.map(c => c.name).join(", ")}</p>}</div>
        {l.type && <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${t.cls}`} data-testid="leave-type-chip">{t.icon} {t.label}</span>}</div>
      <p className="font-semibold" data-testid="leave-when">📅 {leaveWhen(l)}{l.days !== undefined && <span className="font-normal text-ink-500"> · {fmtDays(l.days)} ngày công</span>}</p>
      {l.reason && l.reason !== t?.label && <p className="text-sm">Lý do: {l.reason}</p>}
      <div className="rounded-xl bg-ink-100/60 p-3 text-sm" data-testid="leave-handover"><p className="text-xs text-ink-500">Ghi chú bàn giao lớp</p>
        {note !== null ? <><textarea className="input mt-1" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} />
          <div className="mt-2 flex gap-2"><button className="min-h-12 flex-1 rounded-xl border border-ink-100 bg-white" onClick={() => setNote(null)}>Huỷ</button>
            <button className="btn min-h-12 flex-1" disabled={busy} onClick={() => act(async () => { await patchLeave(l.id, note); setNote(null) }, "Đã lưu ghi chú bàn giao")}>Lưu</button></div></>
          : <p className="whitespace-pre-line">{l.handoverNote || "Chưa có ghi chú"}</p>}
        {mine && note === null && (l.status === "pending" || l.status === "approved") && <button className="mt-1 min-h-12 text-sm text-mint-700 underline" onClick={() => setNote(l.handoverNote ?? "")} data-testid="leave-edit-note">Sửa ghi chú</button>}</div>
      <p className={`rounded-xl border p-2 text-sm font-semibold ${st.cls}`} data-testid="leave-status">{st.label}{l.decidedByName ? ` · ${l.decidedByName}` : ""}{l.decisionNote ? ` – ${l.decisionNote}` : ""}</p>
      {l.substitutions.length > 0 && <ul className="text-sm" data-testid="leave-subs">{l.substitutions.map(s => <li key={s.id}>↔ {dm(s.date)} · {s.class.name}: <b>{s.substituteTeacher?.name}</b></li>)}</ul>}
    </div>
    {admin && l.status === "pending" && <div className="space-y-3" data-testid="leave-approve">
      {open.length > 0 && <div className="rounded-2xl border border-peach-300 bg-peach-50 p-3" data-testid="pick-sub"><b className="text-peach-600">Chọn cô trông thay</b>
        <p className="text-xs text-ink-500">{open.map(c => `${c.class.name} · ${dm(c.date)}`).join(", ")}</p>
        <div className="mt-2 space-y-2">{sugg.map(s => <label key={s.userId} className={`flex min-h-12 items-center gap-3 rounded-xl border bg-white px-3 ${pick === s.userId ? "border-mint-500" : "border-ink-100"}`}>
          <input type="radio" name="sub" className="h-5 w-5" checked={pick === s.userId} onChange={() => setPick(s.userId)} /><span><b>{s.name}</b><span className="block text-xs text-ink-500">{s.freeNote}</span></span></label>)}
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-ink-100 bg-white px-3"><input type="radio" name="sub" className="h-5 w-5" checked={pick === ""} onChange={() => setPick("")} />Chưa phân, phân sau</label></div></div>}
      {rejecting && <textarea className="input" rows={2} placeholder="Lý do từ chối (bắt buộc)" value={why} onChange={e => setWhy(e.target.value)} data-testid="reject-reason" />}
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-12 rounded-xl border-2 border-rose-500 bg-white font-semibold text-rose-500" disabled={busy || (rejecting && !why.trim())} data-testid="leave-reject"
          onClick={() => rejecting ? act(() => rejectLeave(l.id, why.trim()), "Đã từ chối, giáo viên đã được báo") : setRejecting(true)}>{rejecting ? "Gửi từ chối" : "Từ chối"}</button>
        <button className="btn min-h-12" disabled={busy} data-testid="leave-approve-btn"
          onClick={() => act(() => approveLeave(l.id, pick ? { substituteUserId: pick } : {}), pick ? "Đã duyệt và phân trông thay, giáo viên + phụ huynh lớp đã được báo" : "Đã duyệt")}>✓ Duyệt</button></div></div>}
    {!admin && err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
  </div>;
}
