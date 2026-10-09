"use client";
/** Screen 2 – Parent: red pinned card (/today, child detail, /change-password). rose-100 + left rose-500 border, countdown,
 *  52px 'Đúng, cho đón' / 'Không phải người nhà' (2 cols on mobile). After confirming it collapses to a mint-50 row (not hidden). */
import { useCallback, useState } from "react";
import { confirmRequest, idLast4, maskPhone, PickupRequest, rejectRequest, requestDueAt, pickupErrorText } from "@/lib/pickup-api";
import { hhmm, mmss, PersonPhoto, useMsLeft } from "@/components/pickup-safety";

export function PickupConfirmCard({ r, onDone, intent }: { r: PickupRequest; onDone: (msg: string, confirmed: boolean) => void; intent?: "confirm" | "reject" | null }) {
  const due = requestDueAt(r); // server dueAt; createdAt + 15' only if the field is missing
  const left = useMsLeft(due); const expLeft = useMsLeft(r.expiresAt);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [rejecting, setRejecting] = useState(intent === "reject"); const [note, setNote] = useState("");
  const act = async (a: "confirm" | "reject") => { setBusy(true); setErr("");
    try { if (a === "confirm") { await confirmRequest(r.id); setDone(true) } else await rejectRequest(r.id, note.trim() || undefined);
      onDone(a === "confirm" ? `Đã xác nhận ${r.pickerName} đón bé. Nhà trường duyệt xong cô giáo mới giao bé.` : `Đã từ chối ${r.pickerName}. Cô giáo sẽ không giao bé.`, a === "confirm") }
    catch (e) { setErr(pickupErrorText(e)) } finally { setBusy(false) } };
  if (done || (r.parent?.status === "approved" && !r.needsMyAction))
    return <div data-testid="pickup-confirmed-row" data-req={r.id} className="flex min-h-12 items-center rounded-2xl bg-mint-50 px-4 py-2 text-sm leading-snug text-mint-700">
      <span className="line-clamp-2">✓ Đã xác nhận · Chờ nhà trường duyệt{r.pickerName ? <> · <b>{r.pickerName}</b></> : null}</span></div>;
  if (expLeft <= 0) return null;
  return <section data-testid="pickup-confirm-card" data-req={r.id} className={`overflow-hidden rounded-3xl border-l-4 border-rose-500 bg-rose-100 shadow-lg ${intent ? "ring-4 ring-rose-300" : ""}`}>
    <div className="px-4 pt-3 text-sm font-bold text-rose-500" data-testid="pickup-countdown">
      {left > 0 ? <>⚠ CẦN BẠN XÁC NHẬN NGAY · còn {mmss(left)}</> : <>⏰ Hết thời gian chờ · cô giáo sẽ gọi điện cho bạn</>}</div>
    <div className="space-y-3 p-4">
      {intent && <p className="rounded-2xl bg-sun-100 p-2 text-sm" data-testid="pickup-intent">Bạn đã chọn <b>{intent === "confirm" ? "Xác nhận" : "Từ chối"}</b> trên thông báo. Kiểm tra ảnh rồi bấm nút bên dưới để hoàn tất.</p>}
      <div className="flex gap-3"><PersonPhoto url={r.photoUrl} alt={r.pickerName} className="h-36 w-28 shrink-0" testid="pickup-photo" />
        <div className="min-w-0 space-y-1"><div className="text-lg font-bold leading-tight">{r.pickerName}</div>
          {r.relation && <div>“{r.relation} của bé”</div>}
          {r.pickerIdNumberMasked && <div className="text-sm text-ink-500" data-testid="pickup-cccd">CCCD {idLast4(r.pickerIdNumberMasked)}</div>}
          <div className="text-sm text-ink-500">{maskPhone(r.pickerPhone)}</div>
          <div className="text-xs text-ink-500">Đón bé {r.childName ?? ""}{r.className ? ` (${r.className})` : ""} · gửi lúc {hhmm(r.createdAt)}</div></div></div>
      {r.note && <p className="text-sm" data-testid="pickup-note"><span className="text-xs font-semibold text-ink-500">Lời nhắn:</span> {r.note}</p>}
      <p className="text-xs text-ink-500">Người này KHÔNG có trong danh sách đón bé. Chỉ xác nhận khi bạn đã nhờ người này.</p>
      {rejecting && <input className="input" placeholder="Lý do từ chối (không bắt buộc)" value={note} onChange={e => setNote(e.target.value)} data-testid="pickup-reject-note" />}
      {err && <p className="text-sm text-rose-500" data-testid="pickup-confirm-error">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button className="min-h-[52px] rounded-2xl border-2 border-rose-500 bg-white px-2 font-semibold leading-tight text-rose-500" disabled={busy} data-testid="pickup-reject"
          onClick={() => (rejecting ? act("reject") : setRejecting(true))}>{rejecting ? "Chắc chắn không cho đón" : "Không phải người nhà"}</button>
        <button className="min-h-[52px] rounded-2xl px-2 leading-tight bg-mint-500 font-semibold text-white" disabled={busy} data-testid="pickup-confirm" onClick={() => act("confirm")}>Đúng, cho đón</button></div></div></section>;
}
/** Keeps cards the parent just confirmed on screen (as the collapsed mint row) after the feed drops needsMyAction. */
export function useKeptConfirmed() {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const keep = useCallback((id: string) => setKept(k => new Set(k).add(id)), []);
  const show = useCallback((r: PickupRequest) => !!r.needsMyAction || (kept.has(r.id) && r.status === "pending" && r.parent?.status === "approved"), [kept]);
  return { keep, show };
}
