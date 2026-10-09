"use client";
import { DateField } from "@/components/DateField"; import { useCallback, useEffect, useState } from "react"; import { useParams, useRouter } from "next/navigation"; import Link from "next/link";
import { api, http, todayStr } from "@/lib/api"; import { Child, Paged } from "@/lib/types"; import { Photo, WithdrawnBadge } from "@/components/Photo";
import { monthLabel, vnd, vnDate, vnDateTime } from "@/lib/fmt"; import { Balance, Invoice, METHOD, StatusPill } from "../../types";
type Credits = { creditBalance: number; transactions: { id: string; amount: number; type: string; note: string | null; createdAt: string; paymentId: string | null }[] };
type Withdrawal = { status: string; leaveDate: string | null; reason: string | null; outstandingDebt: number; creditBalance: number; netBalance: number; nextAction: string; nextActionText: string;
  payouts: { id: string; voucherNo: string; amount: number; method: string; paidAt: string; recipientName: string }[] };
const TX: Record<string, string> = { prepayment: "Trả trước", overpayment: "Trả thừa", applied: "Trừ vào hóa đơn", restored: "Hoàn lại số dư", adjustment: "Điều chỉnh", meal_clawback: "Thu lại tiền ăn", payout: "Chi trả lại", void_refund: "Hủy hóa đơn đã thu", meal_refund: "Hoàn tiền ăn" };

export default function ChildFees() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const me = api.me()!; const staff = me.role === "admin" || me.role === "accountant";
  const [child, setChild] = useState<Child | null>(null); const [bal, setBal] = useState<Balance | null>(null); const [invs, setInvs] = useState<Invoice[]>([]);
  const [cr, setCr] = useState<Credits | null>(null); const [wd, setWd] = useState<Withdrawal | null>(null); const [panel, setPanel] = useState<"" | "prepay" | "withdraw" | "payout">("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = useCallback(() => {
    http.get<Child>(`/children/${id}`).then(setChild).catch(e => setErr(e.message));
    http.get<Balance>(`/children/${id}/balance`).then(setBal).catch(e => setErr(e.message));
    http.get<Paged<Invoice>>(`/invoices?childId=${id}&limit=50`).then(p => setInvs(p.items)).catch(() => {});
    http.get<Credits>(`/children/${id}/credits`).then(setCr).catch(() => {});
    http.get<Withdrawal>(`/children/${id}/withdrawal`).then(setWd).catch(() => {});
  }, [id]);
  useEffect(() => { load() }, [load]);
  const submit = (path: string, after: (r: Record<string, unknown>) => void) => async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const body: Record<string, unknown> = {}; for (const [k, v] of Object.entries(f)) if (v.trim()) body[k] = k === "amount" ? Number(v.replace(/\D/g, "")) : v.trim();
    setBusy(true); setMsg(""); try { const r = await http.post<Record<string, unknown>>(path, body); setPanel(""); after(r); load() } catch (x) { setMsg("❌ " + (x as Error).message) } finally { setBusy(false) } };
  if (err) return <p className="text-rose-500">{err}</p>; if (!bal) return <p>Đang tải…</p>;
  const withdrawn = (wd?.status ?? child?.status) === "withdrawn";
  return <div className="mx-auto max-w-3xl space-y-4">
    {staff && <Link href="/fees" className="text-sm text-mint-700">‹ Công nợ</Link>}
    <div className="card flex flex-wrap items-center gap-4"><Photo url={child?.photoUrl} id={id} size={64} withdrawn={withdrawn} />
      <div className="flex-1"><h1 className="text-xl font-bold">{bal.fullName} {withdrawn && <WithdrawnBadge className="align-middle" />}</h1><div className="text-sm text-ink-500">{bal.className}{withdrawn && wd?.leaveDate ? ` · nghỉ từ ${vnDate(wd.leaveDate)}` : ""}</div></div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-2xl bg-rose-100 p-2"><div className="text-xs">Còn nợ</div><b data-testid="child-debt">{vnd(bal.balance)}</b></div>
        <div className="rounded-2xl bg-sun-100 p-2"><div className="text-xs">Quá hạn</div><b>{vnd(bal.overdueAmount)}</b></div><div className="rounded-2xl bg-sky-100 p-2"><div className="text-xs">Số dư trả trước</div><b data-testid="child-credit">{vnd(bal.creditBalance)}</b></div></div></div>
    {withdrawn && wd && <div className="card bg-ink-100/60 text-sm"><b>Đã nghỉ học</b>{wd.reason ? ` · Lý do: ${wd.reason}` : ""}<p className="mt-1">{wd.nextActionText}</p></div>}
    <div className="card"><h2 className="mb-2 font-semibold">Hóa đơn</h2>{invs.length === 0 && <p className="text-sm text-ink-500">Chưa có hóa đơn</p>}
      {invs.map(i => <Link key={i.id} href={`/fees/invoice/${i.id}`} data-testid="invoice-row" className={`mb-2 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ${i.overdue && i.status !== "paid" && i.status !== "void" ? "bg-rose-100/60" : "bg-ink-100/30"}`}>
        <span>{monthLabel(i.period)} <span className="text-xs text-ink-500">· {i.invoiceNo} · hạn {vnDate(i.dueDate)}</span></span><span className="ml-auto flex shrink-0 items-center gap-2"><span className="flex flex-col items-end leading-tight"><span className="whitespace-nowrap tabular-nums">{vnd(i.totalAmount)}</span>{i.balance > 0 && i.status !== "void" && <span className="whitespace-nowrap text-xs tabular-nums text-rose-500" data-testid="invoice-remaining">còn {vnd(i.balance)}</span>}</span><StatusPill inv={i} /></span></Link>)}</div>
    {cr && cr.transactions.length > 0 && <div className="card"><h2 className="mb-2 font-semibold">Biến động số dư trả trước</h2>{cr.transactions.map(t => <div key={t.id} className="flex justify-between gap-2 border-t border-ink-100 py-2 text-sm">
      <span>{TX[t.type] ?? t.type} · {vnDateTime(t.createdAt)}{t.note ? <span className="text-ink-500"> · {t.note}</span> : null}{t.paymentId && <> · <Link className="text-mint-700 underline" href={`/fees/receipt/${t.paymentId}`}>Biên lai</Link></>}</span>
      <b className={t.amount >= 0 ? "text-mint-700" : "text-rose-500"}>{t.amount >= 0 ? "+" : "−"}{vnd(Math.abs(t.amount))}</b></div>)}</div>}
    {wd && wd.payouts.length > 0 && <div className="card"><h2 className="mb-2 font-semibold">Phiếu chi hoàn tiền</h2>{wd.payouts.map(p => <div key={p.id} className="flex justify-between border-t border-ink-100 py-2 text-sm">
      <span>{p.voucherNo} · {vnDateTime(p.paidAt)} · {p.recipientName} · {METHOD[p.method]}</span><span className="flex gap-3"><b>{vnd(p.amount)}</b><Link href={`/fees/receipt/voucher/${p.id}`} className="text-mint-700 underline" data-testid="link-voucher">In phiếu chi</Link></span></div>)}</div>}
    {staff && <div className="card space-y-3"><div className="flex flex-wrap gap-2">
      {!withdrawn && <button className="btn" onClick={() => setPanel(panel === "prepay" ? "" : "prepay")} data-testid="btn-prepay">💳 Thu trả trước</button>}
      {withdrawn && bal.creditBalance > 0 && <button className="btn !bg-peach-500 disabled:!bg-ink-100" onClick={() => setPanel(panel === "payout" ? "" : "payout")} data-testid="btn-payout">Lập phiếu chi hoàn {vnd(bal.creditBalance)}</button>}
      {!withdrawn && <button className="btn !bg-white !text-ink-700 ring-1 ring-ink-100" onClick={() => setPanel(panel === "withdraw" ? "" : "withdraw")} data-testid="btn-withdraw">Cho bé nghỉ học</button>}</div>
      {panel === "prepay" && <form className="grid gap-2 sm:grid-cols-2" onSubmit={submit(`/children/${id}/prepayments`, r => router.push(`/fees/receipt/${r.paymentId}`))}>
        <input name="amount" className="input" placeholder="Số tiền trả trước" inputMode="numeric" required data-testid="prepay-amount" /><select name="method" className="input" data-testid="prepay-method"><option value="transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option></select>
        <input name="payerName" className="input" placeholder="Người nộp" /><input name="note" className="input" placeholder="Ghi chú" />
        <p className="text-xs text-ink-500 sm:col-span-2">Tiền trả nợ cũ trước, phần dư thành số dư và tự trừ vào hóa đơn sau.</p><button className="btn sm:col-span-2" disabled={busy} data-testid="btn-save-prepay">Ghi thu và in biên lai</button></form>}
      {panel === "withdraw" && <form className="grid gap-2 rounded-2xl bg-ink-100/50 p-3 sm:grid-cols-2" onSubmit={submit(`/children/${id}/withdraw`, () => setMsg("Đã chuyển bé sang trạng thái Đã nghỉ. Công nợ đã được chốt."))}>
        <label className="text-sm">Ngày học cuối cùng<DateField name="leaveDate" max={todayStr()} defaultValue={todayStr()} required data-testid="withdraw-date" /></label>
        <label className="text-sm">Lý do<input name="reason" className="input" required placeholder="vd: Chuyển nhà" data-testid="withdraw-reason" /></label>
        <p className="text-xs text-ink-500 sm:col-span-2">Học phí tháng nghỉ tính nguyên tháng, tiền ăn tính theo ngày đi học thực tế. Số dư dương sẽ được lập phiếu chi hoàn lại; nợ còn lại vẫn nằm trong công nợ. Dữ liệu của bé không bị xóa.</p>
        <button className="btn !bg-ink-700 sm:col-span-2" disabled={busy} data-testid="btn-confirm-withdraw">Xác nhận cho nghỉ học</button></form>}
      {panel === "payout" && <form className="grid gap-2 rounded-2xl bg-peach-50 p-3 sm:grid-cols-2" onSubmit={submit(`/children/${id}/refund-payouts`, r => router.push(`/fees/receipt/voucher/${r.payoutId}`))}>
        <input name="recipientName" className="input" required placeholder="Người nhận tiền" data-testid="payout-recipient" /><select name="method" className="input"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select>
        <input name="note" className="input sm:col-span-2" placeholder="Ghi chú" /><button className="btn !bg-peach-500 disabled:!bg-ink-100 sm:col-span-2" disabled={busy} data-testid="btn-save-payout">Chi {vnd(bal.creditBalance)} và in phiếu chi</button></form>}
      {msg && <p className="text-sm" data-testid="child-fee-msg">{msg}</p>}</div>}
  </div>;
}
