"use client";
/** Accountant/admin: "Đối soát chuyển khoản" queue (mockups7). Confirm = record the amount actually received (partial / credit handled
 *  by the server); reject needs a reason the parent will see. Nothing is marked paid until the server confirms. */
import { useCallback, useEffect, useRef, useState } from "react"; import Link from "next/link";
import { vnd, vnDateTime } from "@/lib/fmt"; import { Photo } from "@/components/Photo";
import { CLAIM_REJECT_PRESETS, confirmClaim, feesErrorText, listClaims, rejectClaim, TransferClaim } from "@/lib/fees-api";

export function TransferQueue({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<TransferClaim[] | null>(null); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const load = useCallback(() => { listClaims({ status: "pending_confirmation" }).then(setItems).catch(e => setErr(feesErrorText(e))) }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load]);
  const done = (m: string) => { setMsg(m); load(); onChanged?.() };
  return <div className="card space-y-3" data-testid="transfer-queue">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Đối soát chuyển khoản</h2>
      {items && <span className="rounded-full bg-sun-100 px-3 py-1 text-sm font-semibold" data-testid="queue-count">{items.length} giao dịch chờ</span>}</div>
    {err && <p className="text-sm text-rose-600">{err}</p>}{msg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="queue-msg">{msg}</p>}
    {items?.length === 0 && <p className="py-6 text-center text-ink-500">Không có giao dịch chờ đối soát 🎉</p>}
    <div className="space-y-2">{items?.map(c => <ClaimRow key={c.id} c={c} onDone={done} />)}</div>
    <p className="text-xs text-ink-500">Đối chiếu sao kê ngân hàng theo nội dung (mã hóa đơn) trước khi xác nhận. Nhận thiếu → hóa đơn còn nợ phần thiếu; nhận thừa → cộng vào số dư trả trước.</p></div>;
}

function ClaimRow({ c, onDone }: { c: TransferClaim; onDone: (m: string) => void }) {
  const due = c.amountDue ?? c.amount; const diff = c.difference ?? c.amount - due;
  const [mode, setMode] = useState<"" | "confirm" | "reject">(""); const [amount, setAmount] = useState(String(c.amount)); const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const inflight = useRef(false);
  const n = Number(amount.replace(/\D/g, "")) || 0;
  const run = async <R,>(f: () => Promise<R>, m: (r: R) => string) => { if (inflight.current) return; inflight.current = true; setBusy(true); setErr("");
    try { const r = await f(); onDone(m(r)) } catch (e) { setErr(feesErrorText(e)) } finally { inflight.current = false; setBusy(false) } };
  return <div className={`space-y-2 rounded-2xl p-3 ${diff !== 0 ? "bg-sun-100" : "bg-ink-100/40"}`} data-testid="claim-row" data-mismatch={diff !== 0}>
    <div className="flex flex-wrap items-center gap-3"><Photo id={c.childId} size={40} />
      <div className="min-w-0 flex-1"><b>{c.childName}</b> <span className="text-sm text-ink-500">· {c.className}</span>
        <div className="text-xs text-ink-500"><Link href={`/fees/invoice/${c.invoiceId}`} className="font-mono underline">{c.invoiceNo}</Link> · {c.claimedBy?.name ?? "Phụ huynh"}{c.onBehalf ? " (ghi hộ)" : ""} báo lúc {vnDateTime(c.claimedAt)}{c.transferredAt ? ` · chuyển ${vnDateTime(c.transferredAt)}` : ""}</div></div>
      <div className="text-right text-sm"><div>Phải thu <b>{vnd(due)}</b></div>
        <div className={diff !== 0 ? "font-semibold text-peach-600" : ""}>PH báo {vnd(c.amount)}{diff !== 0 && <> ⚠ lệch {vnd(Math.abs(diff))}</>}</div></div></div>
    {!mode && <div className="flex flex-wrap justify-end gap-2">
      <button className="min-h-12 rounded-xl px-4 text-sm font-semibold text-rose-600 ring-1 ring-rose-100" onClick={() => setMode("reject")} data-testid="claim-reject-open">Từ chối…</button>
      <button className="min-h-12 rounded-xl bg-mint-500 px-4 text-sm font-semibold text-white" onClick={() => setMode("confirm")} data-testid="claim-confirm-open">{diff < 0 ? "Ghi thu một phần" : "Xác nhận ✓"}</button></div>}
    {mode === "confirm" && <div className="space-y-2 rounded-2xl bg-white p-3">
      <label className="block text-sm">Số tiền thực nhận (theo sao kê)<input className="input mt-1 text-lg" inputMode="numeric" value={n ? n.toLocaleString("vi-VN") : ""} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} data-testid="claim-amount" /></label>
      {n > 0 && n < due && <p className="text-xs text-peach-600">Thu một phần: hóa đơn còn nợ {vnd(due - n)}.</p>}
      {n > due && <p className="text-xs text-sky-500">Thừa {vnd(n - due)}: cộng vào số dư trả trước của bé.</p>}
      <div className="grid grid-cols-2 gap-2"><button className="min-h-12 rounded-xl bg-ink-100 font-semibold" onClick={() => setMode("")} disabled={busy}>Hủy</button>
        <button className="min-h-12 rounded-xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || !n} data-testid="claim-confirm"
          onClick={() => confirm(`Xác nhận đã nhận ${vnd(n)} cho ${c.invoiceNo}? Hệ thống sẽ ghi thu và tạo biên lai.`) && run(() => confirmClaim(c.id, n), r => `Đã ghi thu ${vnd(n)} cho ${c.childName}${r.receipt?.receiptNo ? ` · biên lai ${r.receipt.receiptNo}` : ""}.`)}>
          {busy ? "Đang lưu…" : "Ghi thu & tạo biên lai"}</button></div></div>}
    {mode === "reject" && <div className="space-y-2 rounded-2xl bg-white p-3">
      <div className="flex flex-wrap gap-1">{CLAIM_REJECT_PRESETS.map(p => <button key={p} type="button" onClick={() => setReason(p)} className={`min-h-12 rounded-full px-3 text-xs ${reason === p ? "bg-ink-900 text-white" : "bg-ink-100"}`}>{p}</button>)}</div>
      <textarea className="input" maxLength={300} placeholder="Lý do (phụ huynh sẽ thấy)" value={reason} onChange={e => setReason(e.target.value)} data-testid="claim-reason" />
      <div className="grid grid-cols-2 gap-2"><button className="min-h-12 rounded-xl bg-ink-100 font-semibold" onClick={() => setMode("")} disabled={busy}>Hủy</button>
        <button className="min-h-12 rounded-xl bg-rose-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || !reason.trim()} data-testid="claim-reject"
          onClick={() => run(() => rejectClaim(c.id, reason.trim()), () => `Đã từ chối giao dịch của ${c.childName}. Phụ huynh sẽ nhận lý do.`)}>{busy ? "Đang lưu…" : "Từ chối"}</button></div></div>}
    {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}</div>;
}
