"use client";
/** Admin emergency closure for today (round2 §2 Emergency, 2b). dryRun fills the impact line; red button only with a reason. */
import { useEffect, useState } from "react";
import { emergencyClose, emergencyPreview, EmergencyPreview, EMERGENCY_REASONS, msgErrorText } from "@/lib/messages-api";
import { fmtDate } from "@/lib/date";

const NO_PHONE = "Chưa có số điện thoại";
const noPhone = (k: { phone1: string | null }) => !k.phone1?.trim();
/** dryRun.childrenWithoutParent: kids with no linked parent account → staff must phone. */
export type NoParentKid = { childId: string; name: string; className: string | null; phone1: string | null };
const csvCell = (v: string) => /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
function downloadCsv(kids: NoParentKid[], date: string) {
  const rows = [["Lớp", "Họ tên", "Số liên hệ 1"], ...kids.map(k => [k.className ?? "", k.name, k.phone1?.trim() || NO_PHONE])];
  const blob = new Blob(["\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `be-chua-co-tk-phu-huynh-${date}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
}
function NoParentBox({ kids, count, date }: { kids: NoParentKid[]; count: number; date: string }) {
  const [all, setAll] = useState(false);
  // by class; within a class kids WITHOUT a phone first so they aren't missed
  const sorted = [...kids].sort((a, b) => (a.className ?? "").localeCompare(b.className ?? "", "vi") || Number(noPhone(b)) - Number(noPhone(a)) || a.name.localeCompare(b.name, "vi"));
  const shown = all ? sorted : sorted.slice(0, 5);
  const groups = Array.from(new Set(shown.map(k => k.className ?? "Chưa xếp lớp")));
  return <div className="space-y-2 rounded-2xl bg-sun-100 p-3 text-sm text-ink-900" data-testid="emergency-no-parent">
    <b className="block">Còn {count} bé chưa có tài khoản phụ huynh, cần gọi điện:</b>
    {groups.map(g => <div key={g}><div className="text-xs font-semibold text-ink-500">{g}</div>
      <ul className="divide-y divide-sun-500/30">{shown.filter(k => (k.className ?? "Chưa xếp lớp") === g).map(k => <li key={k.childId} className="flex min-h-12 items-center justify-between gap-2" data-testid="emergency-no-parent-row">
        <span>{k.name}</span>{!noPhone(k) ? <a href={`tel:${k.phone1!.replace(/\s/g, "")}`} className="flex min-h-12 items-center font-semibold text-mint-700 underline">{k.phone1}</a>
          : <span className="whitespace-nowrap rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-600" data-testid="emergency-no-phone">{NO_PHONE}</span>}</li>)}</ul></div>)}
    <div className="flex flex-wrap gap-2">
      {kids.length > 5 && <button type="button" className="min-h-12 rounded-xl bg-white px-3 font-semibold" onClick={() => setAll(!all)} data-testid="emergency-no-parent-all">{all ? "Thu gọn" : `Xem tất cả ${Math.max(count, kids.length)} bé`}</button>}
      {kids.length > 0 && <button type="button" className="min-h-12 rounded-xl bg-white px-3 font-semibold" onClick={() => downloadCsv(sorted, date)} data-testid="emergency-no-parent-csv">⬇ Tải danh sách</button>}</div></div>;
}

export function EmergencyDialog({ date, onClose, onDone }: { date: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [chip, setChip] = useState(""); const [detail, setDetail] = useState(""); const [pv, setPv] = useState<EmergencyPreview | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  // counts don't depend on the reason; the API requires a non-blank one, so preview with a placeholder (dryRun writes nothing)
  useEffect(() => { emergencyPreview(date, "Xem trước").then(setPv).catch(e => setErr(msgErrorText(e))) }, [date]);
  const np = pv?.childrenWithoutParent ?? []; const npCount = pv?.childrenWithoutParentCount ?? np.length;
  const reason = chip && detail.trim() ? (chip === "Khác" ? detail.trim() : `${chip}: ${detail.trim()}`) : "";
  const go = async () => { if (!reason || busy) return; setBusy(true); setErr("");
    try { const r = await emergencyClose(date, reason); onDone(`Đã đóng cửa ngày ${fmtDate(date)}. Đã báo ${r.parentsNotified} phụ huynh, hoàn suất ăn ${r.childrenRefunded} bé.`) }
    catch (e) { setErr(msgErrorText(e)) } finally { setBusy(false) } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" data-testid="emergency-dialog">
    <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
      <h2 className="shrink-0 border-b border-ink-100 px-5 py-4 text-lg font-bold text-rose-500">⚠ Đóng cửa đột xuất · {fmtDate(date)}</h2>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4" data-testid="emergency-body">
      <p className="rounded-2xl bg-rose-100 p-3 text-sm" data-testid="emergency-impact">{pv
        ? <>Gửi thông báo khẩn tới <b>{pv.parentsToNotify}</b> phụ huynh. Hoàn suất ăn cho <b>{pv.childrenRefunded}</b> bé chưa đến. Điểm danh đã ghi giữ nguyên.</>
        : err ? "Không tính được số liệu." : "Đang tính số phụ huynh và bé…"}</p>
      {npCount > 0 && <NoParentBox kids={np} count={npCount} date={date} />}
      <div><div className="mb-1 text-sm font-semibold">Lý do</div>
        <div className="flex flex-wrap gap-2">{EMERGENCY_REASONS.map(c => <button key={c} type="button" onClick={() => setChip(c)} data-testid="emergency-chip"
          className={`min-h-12 rounded-full px-4 text-sm ${chip === c ? "bg-rose-500 font-semibold text-white" : "bg-ink-100"}`}>{c}</button>)}</div></div>
      <textarea className="input min-h-24" maxLength={480} placeholder="Chi tiết (bắt buộc), vd: Bão số 5, nước ngập sân trường" value={detail} onChange={e => setDetail(e.target.value)} data-testid="emergency-detail" />
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}</div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-ink-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-testid="emergency-footer">
        <button type="button" className="min-h-12 rounded-xl bg-ink-100 font-semibold" onClick={onClose} disabled={busy}>Hủy</button>
        <button type="button" className="min-h-12 rounded-xl bg-rose-500 px-2 font-semibold leading-tight text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={!reason || busy} onClick={go} data-testid="emergency-confirm">
          {busy ? "Đang gửi…" : "Đóng cửa ngay"}</button></div></div></div>;
}
