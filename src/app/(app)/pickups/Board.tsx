"use client";
/** Screen 5 – "Đón bé hôm nay": admin / today's duty account. One-tap approve; reject needs a reason (presets); yellow multi-child warning. */
import { useCallback, useEffect, useState } from "react"; import { todayStr } from "@/lib/api";
import { confirmRequest, idLast4, listRequests, OUTCOME_TEXT, parentOnBehalf, PickupRequest, REJECT_PRESETS, rejectRequest, requestDueAt, pickupErrorText } from "@/lib/pickup-api";
import { hhmm, mmss, PersonPhoto, ReasonBox, useMsLeft } from "@/components/pickup-safety";

export function Board({ isAdmin }: { isAdmin: boolean }) {
  const [rs, setRs] = useState<PickupRequest[] | null>(null); const [err, setErr] = useState("");
  const load = useCallback(() => listRequests({ status: "pending", date: todayStr() }).then(x => { setRs(x); setErr("") }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load]);
  const waiting = rs?.filter(r => r.school.status === "pending").length ?? 0;
  return <section className="card space-y-3" data-testid="pickup-board">
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">Giao bé hôm nay</h2>
      {waiting > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-500" data-testid="board-count">{waiting} yêu cầu chờ duyệt</span>}</div>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    {rs?.length === 0 && <p className="rounded-2xl bg-mint-50 p-3 text-sm text-mint-700">Không có yêu cầu nào đang chờ.</p>}
    <div className="grid gap-3 md:grid-cols-2">{rs?.map(r => <BoardCard key={r.id} r={r} isAdmin={isAdmin} onChange={load} />)}</div></section>;
}

function BoardCard({ r, isAdmin, onChange }: { r: PickupRequest; isAdmin: boolean; onChange: () => void }) {
  const left = useMsLeft(requestDueAt(r)); const [mode, setMode] = useState<null | "reject" | "behalf">(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const parentOk = r.parent.status === "approved"; const urgent = r.school.status === "pending" && parentOk;
  const phoneYes = r.escalation?.callAttempts.filter(a => a.outcome === "confirmed").at(-1);
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await f(); setMode(null); onChange() } catch (e) { setErr(pickupErrorText(e)) } finally { setBusy(false) } };
  return <div className={`space-y-2 rounded-2xl border-2 p-3 ${urgent ? "border-rose-500" : "border-ink-100"}`} data-testid="board-card" data-req={r.id}>
    <div className="flex gap-3"><PersonPhoto url={r.photoUrl} alt={r.pickerName} className="h-20 w-20 shrink-0" />
      <div className="min-w-0 text-sm"><b className="text-base">{r.pickerName}</b>{r.relation && ` (${r.relation})`}
        <div>đón <b>{r.childName ?? ""}</b>{r.className && <span data-testid="board-class"> ({r.className})</span>} · {hhmm(r.createdAt)}</div><div className="text-ink-500">Căn cước {idLast4(r.pickerIdNumberMasked)} · {r.pickerPhone}</div>
        <div data-testid="board-parent" className={parentOk ? "text-mint-700" : r.parent.status === "rejected" ? "text-rose-500" : "text-ink-900"}>
          {parentOk ? `✓ ${r.parent.decidedByName ?? "Phụ huynh"} đã xác nhận${r.parent.channel === "on_behalf" ? " (qua ĐT)" : ""}`
            : r.parent.status === "rejected" ? "⛔ Phụ huynh từ chối" : `⏳ Chờ phụ huynh · ${left > 0 ? mmss(left) : "quá 15 phút"}`}</div>
        {r.school.status !== "pending" && <div className="text-mint-700">✓ Nhà trường: {r.school.decidedByName}</div>}</div></div>
    {r.note && <p className="text-xs text-ink-500">“{r.note}”</p>}
    {(r.warnings ?? []).map(w => <p key={w.code} className="rounded-xl bg-sun-100 p-2 text-xs" data-testid="board-warning">⚠ {w.message}</p>)}
    {phoneYes && r.parent.status === "pending" && <div className="rounded-xl bg-sun-100 p-2 text-xs" data-testid="board-phone-yes">📞 {phoneYes.calledByName} gọi {phoneYes.phone}: <b>{OUTCOME_TEXT.confirmed}</b>{phoneYes.note ? ` – ${phoneYes.note}` : ""}
      {isAdmin ? <button className="mt-1 block min-h-12 w-full rounded-xl bg-white font-semibold" onClick={() => setMode("behalf")} data-testid="board-behalf">Xác nhận thay phụ huynh…</button>
        : <span className="block">Chờ Ban giám hiệu xác nhận thay phụ huynh.</span>}</div>}
    {err && <p className="text-sm text-rose-500">{err}</p>}
    {mode === "reject" && <ReasonBox presets={REJECT_PRESETS} busy={busy} onCancel={() => setMode(null)} onSubmit={n => run(() => rejectRequest(r.id, n))} />}
    {mode === "behalf" && <ReasonBox presets={phoneYes?.note ? [phoneYes.note] : []} busy={busy} label="Ghi chú bắt buộc: đã liên lạc phụ huynh thế nào" cta="Ghi nhận PH đồng ý" testid="behalf-note"
      onCancel={() => setMode(null)} onSubmit={n => run(() => parentOnBehalf(r.id, "approve", n))} />}
    {!mode && r.school.status === "pending" && <div className="grid grid-cols-2 gap-2">
      <button className="min-h-12 rounded-xl border-2 border-rose-500 font-semibold text-rose-500" disabled={busy} onClick={() => setMode("reject")} data-testid="board-reject">Từ chối…</button>
      <button className="min-h-12 rounded-xl bg-mint-500 font-semibold text-white" disabled={busy} onClick={() => run(() => confirmRequest(r.id))} data-testid="board-approve">Duyệt ✓</button></div>}
    {r.school.status === "approved" && <p className="text-xs text-ink-500">Bạn đã duyệt: người khác phải giao bé.</p>}</div>;
}
