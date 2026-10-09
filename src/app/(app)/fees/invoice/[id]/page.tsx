"use client";
import { useCallback, useEffect, useState } from "react"; import { useParams, useRouter } from "next/navigation"; import Link from "next/link";
import { api, http } from "@/lib/api"; import { monthLabel, vnd, vnDate, vnDateTime } from "@/lib/fmt";
import { Invoice, Line, METHOD, StatusPill, Warning, isWaived } from "../../types"; import { QrPay } from "../../QrPay";
type Hist = { id: string; action: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null; changedByName: string; changedAt: string };
const LINE_STYLE: Record<string, [string, string]> = { refund: ["text-mint-700", "↩ "], discount: ["text-sky-500", "🏷 Giảm trừ: "], credit: ["text-sky-500", "💳 "] };
const ACTION: Record<string, string> = { voided: "Hủy hóa đơn", line_added: "Thêm khoản", line_updated: "Sửa khoản", line_removed: "Xóa khoản", line_deleted: "Xóa khoản", payment: "Ghi thu" };

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const me = api.me()!; const staff = me.role === "admin" || me.role === "accountant";
  const [inv, setInv] = useState<Invoice | null>(null); const [hist, setHist] = useState<Hist[]>([]); const [err, setErr] = useState(""); const [warn, setWarn] = useState<Warning[]>([]);
  const [amount, setAmount] = useState(""); const [method, setMethod] = useState<"transfer" | "cash">("transfer"); const [payer, setPayer] = useState(""); const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false); const [reason, setReason] = useState(""); const [msg, setMsg] = useState("");
  const [lineOpen, setLineOpen] = useState(false);
  const load = useCallback(() => {
    http.get<Invoice>(`/invoices/${id}`).then(i => { setInv(i); setAmount(i.balance > 0 ? String(i.balance) : "") }).catch(e => setErr(e.message));
    if (staff) http.get<Hist[]>(`/invoices/${id}/history`).then(setHist).catch(() => {});
  }, [id, staff]);
  useEffect(() => { load() }, [load]);
  const invId = inv?.id; useEffect(() => { if (invId && location.hash === "#qr") setTimeout(() => document.getElementById("qr")?.scrollIntoView({ behavior: "smooth", block: "start" }), 400) }, [invId]);
  if (err) return <p className="text-rose-500">{err}</p>; if (!inv) return <p>Đang tải…</p>;
  const lines = inv.lines ?? []; const open = inv.status !== "void" && inv.status !== "paid";
  async function pay(e: React.FormEvent) { e.preventDefault(); const n = Number(amount.replace(/\D/g, "")); if (!n) { setMsg("Nhập số tiền"); return }
    setBusy(true); setMsg(""); try { const r = await http.post<{ paymentId: string; creditAdded: number }>(`/invoices/${id}/payments`, { amount: n, method, ...(payer.trim() ? { payerName: payer.trim() } : {}) });
      router.push(`/fees/receipt/${r.paymentId}`) } catch (x) { setMsg((x as Error).message) } finally { setBusy(false) } }
  async function doVoid() { if (!reason.trim()) { setMsg("Vui lòng nhập lý do hủy"); return } setBusy(true); setMsg("");
    try { await http.post(`/invoices/${id}/void`, { reason: reason.trim() }); setVoidOpen(false); setReason(""); setMsg(inv!.paidAmount > 0 ? `Đã hủy hóa đơn. ${vnd(inv!.paidAmount)} đã thu được chuyển vào số dư của bé.` : "Đã hủy hóa đơn."); load() }
    catch (x) { setMsg((x as Error).message) } finally { setBusy(false) } }
  async function addLine(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const kind = String(f.get("kind"));
    setMsg(""); try { const r = await http.post<Invoice>(`/invoices/${id}/lines`, { kind, description: String(f.get("description")), quantity: 1, unitPrice: Number(String(f.get("unitPrice")).replace(/\D/g, "")), ...(kind !== "charge" ? { reason: String(f.get("reason")) } : {}) });
      setWarn(r?.warnings ?? []); setLineOpen(false); load() } catch (x) { setMsg((x as Error).message) } }
  return <div className="mx-auto max-w-3xl space-y-4">
    <Link href={me.role === "parent" ? "/fees" : `/fees/child/${inv.childId}`} className="text-sm text-mint-700">‹ {me.role === "parent" ? "Học phí" : `Công nợ của ${inv.childName}`}</Link>
    <div className="card space-y-3" data-testid="invoice-detail">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm text-ink-500">Chi tiết hóa đơn · {inv.invoiceNo}</div><h1 className="text-xl font-bold">{inv.childName} · {monthLabel(inv.period)}</h1><div className="text-sm text-ink-500">{inv.className} · Lập {vnDate(inv.issueDate)} · Hạn {vnDate(inv.dueDate)}</div></div><StatusPill inv={inv} /></div>
      <div className="divide-y divide-ink-100">{lines.map(l => <LineRow key={l.id} l={l} />)}</div>
      {warn.length > 0 && <div className="rounded-2xl bg-sun-100 p-3 text-sm" data-testid="invoice-warnings">{warn.map((w, i) => <p key={i}>⚠ {w.message}</p>)}</div>}
      <div className="flex justify-between border-t-2 border-ink-100 pt-3 text-lg"><b>Tổng phải đóng</b><b>{vnd(inv.totalAmount)}</b></div>
      {inv.paidAmount > 0 && <div className="flex justify-between text-sm"><span>Đã thu</span><span className="text-mint-700">{vnd(inv.paidAmount)}</span></div>}
      {inv.status !== "void" && <div className="flex justify-between text-lg"><b>Cần đóng</b><b className={inv.balance > 0 ? "text-rose-500" : "text-mint-700"} data-testid="invoice-balance">{vnd(inv.balance)}</b></div>}
      {isWaived(inv) && <p className="rounded-2xl bg-sky-100 p-3 text-sm text-sky-500" data-testid="invoice-waived">Miễn/giảm 100% · hóa đơn không phát sinh tiền thu nên không có biên lai.</p>}
      {inv.absenceDays && inv.absenceDays.length > 0 && <div className="rounded-2xl bg-ink-100/40 p-3 text-sm" data-testid="invoice-absence-days"><b className="block">Ngày nghỉ trong kỳ</b>
        {inv.absenceDays.map(d => <div key={d.date} className="flex justify-between gap-2"><span>{vnDate(d.date)}</span>
          <span className={d.refundEligible ? "text-mint-700" : "text-ink-500"}>{d.refundEligible ? `Được hoàn${d.amount ? ` ${vnd(Math.abs(d.amount))}` : ""}` : "Báo sau giờ chốt, không hoàn"}</span></div>)}</div>}
      {inv.note && <p className="text-sm text-ink-500">Ghi chú: {inv.note}</p>}
    </div>
    {me.role === "parent" && inv.status !== "void" && (inv.balance > 0 || inv.transferClaim) && <div id="qr" className="scroll-mt-4"><QrPay inv={inv} onChange={load} /></div>}
    {(inv.payments ?? []).length > 0 && <div className="card"><h2 className="mb-2 font-semibold">Các lần thu</h2>{inv.payments!.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 py-2 text-sm">
      <span>{p.receiptNo} · {vnDateTime(p.paidAt)} · {METHOD[p.method]}{p.payerName ? ` · ${p.payerName}` : ""}</span><span className="flex items-center gap-3"><b>{vnd(p.amount)}</b>{!isWaived(inv) && p.amount > 0 && <Link href={`/fees/receipt/${p.id}`} className="text-mint-700 underline" data-testid="link-receipt">Biên lai</Link>}</span></div>)}</div>}
    {staff && open && <form onSubmit={pay} className="card space-y-3 bg-mint-50" data-testid="payment-form"><h2 className="font-semibold">Ghi thanh toán</h2>
      <label className="block text-sm">Số tiền<input className="input mt-1 text-lg" inputMode="numeric" value={amount ? Number(amount.replace(/\D/g, "") || 0).toLocaleString("vi-VN") : ""} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} data-testid="pay-amount" /></label>
      {Number(amount) > inv.balance && <p className="text-xs text-sky-500">Phần dư {vnd(Number(amount) - inv.balance)} sẽ được cộng vào số dư trả trước của bé.</p>}
      <div className="grid grid-cols-2 gap-2">{(["transfer", "cash"] as const).map(m => <button type="button" key={m} onClick={() => setMethod(m)} data-testid={`pay-method-${m}`} className={`min-h-12 rounded-xl border-2 ${method === m ? "border-mint-500 bg-white font-semibold" : "border-transparent bg-white/60"}`}>{METHOD[m]}</button>)}</div>
      <input className="input" placeholder="Người nộp (không bắt buộc)" value={payer} onChange={e => setPayer(e.target.value)} data-testid="pay-payer" />
      <button className="btn w-full" disabled={busy} data-testid="btn-pay">Xác nhận và in biên lai</button></form>}
    {staff && inv.status !== "void" && <div className="card space-y-2">
      <div className="flex flex-wrap gap-2">{inv.status !== "paid" && <button className="btn !bg-white !text-mint-700 ring-1 ring-mint-300" onClick={() => setLineOpen(!lineOpen)} data-testid="btn-add-line">+ Thêm khoản / giảm trừ</button>}
        <button className="btn !bg-white !text-rose-500 ring-1 ring-rose-100" onClick={() => setVoidOpen(!voidOpen)} data-testid="btn-void">Hủy hóa đơn</button></div>
      {lineOpen && <form onSubmit={addLine} className="grid gap-2 sm:grid-cols-2"><select name="kind" className="input" data-testid="line-kind"><option value="charge">Khoản thu thêm</option><option value="discount">Giảm trừ</option><option value="refund">Hoàn tiền (vd: tiền ăn)</option></select>
        <input name="description" className="input" placeholder="Nội dung" required data-testid="line-desc" /><input name="unitPrice" className="input" placeholder="Số tiền" inputMode="numeric" required data-testid="line-amount" />
        <input name="reason" className="input" placeholder="Lý do (bắt buộc với giảm trừ, hoàn tiền)" data-testid="line-reason" /><button className="btn sm:col-span-2" data-testid="btn-save-line">Lưu khoản</button></form>}
      {voidOpen && <div className="space-y-2 rounded-2xl bg-rose-100 p-3"><p className="text-sm">{inv.paidAmount > 0 ? `Hóa đơn đã thu ${vnd(inv.paidAmount)}. Khi hủy, số tiền này sẽ chuyển vào số dư của bé.` : "Hóa đơn sẽ chuyển sang trạng thái Đã hủy."} Việc hủy được lưu lịch sử.</p>
        <textarea className="input" placeholder="Lý do hủy (bắt buộc)" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} data-testid="void-reason" />
        <button className="btn w-full !bg-rose-500 disabled:!bg-ink-100" disabled={busy} onClick={doVoid} data-testid="btn-confirm-void">Xác nhận hủy hóa đơn</button></div>}</div>}
    {msg && <p className="text-sm" data-testid="invoice-msg">{msg}</p>}
    {staff && hist.length > 0 && <div className="card"><h2 className="mb-2 font-semibold">Lịch sử thay đổi</h2>{hist.map(h => <div key={h.id} className="border-t border-ink-100 py-2 text-sm">
      <b>{ACTION[h.action] ?? h.action}</b> · {h.changedByName} · {vnDateTime(h.changedAt)}{h.new?.reason ? <> · Lý do: “{String(h.new.reason)}”</> : null}{typeof h.new?.movedToCredit === "number" && (h.new.movedToCredit as number) > 0 ? <> · chuyển {vnd(h.new.movedToCredit as number)} vào số dư</> : null}</div>)}</div>}
  </div>;
}
function LineRow({ l }: { l: Line }) {
  const [c, pre] = LINE_STYLE[l.kind] ?? ["", ""];
  return <div className={`flex justify-between gap-3 py-2 ${c}`} data-testid={`line-${l.kind}`}><div><div>{pre}{l.description}{l.quantity > 1 && <span className="text-ink-500"> ({l.quantity} × {vnd(l.unitPrice)})</span>}</div>
    {l.reason && <div className="text-xs text-ink-500">Lý do: {l.reason}</div>}</div><div className="whitespace-nowrap">{l.amount < 0 ? "−" + vnd(-l.amount) : vnd(l.amount)}</div></div>;
}
