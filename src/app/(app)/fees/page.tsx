"use client";
import { useCallback, useEffect, useState } from "react"; import Link from "next/link";
import { api, http } from "@/lib/api"; import { ClassRoom, Child, Paged } from "@/lib/types"; import { Photo, WithdrawnBadge } from "@/components/Photo";
import { addMonth, monthLabel, short, thisMonth, vnd, vnDate } from "@/lib/fmt";
import { Debts, Invoice, StatusPill } from "./types"; import { TransferQueue } from "./TransferQueue"; import { FeeFeatures, feeFeatures } from "@/lib/fees-api";
type Fin = { current: { totalCreditBalance: number }; byPeriod: { month: string; invoiced: number; collected: number }[] };

export default function FeesPage() {
  const me = api.me();
  if (me?.role === "parent") return <ParentFees />;
  return <StaffFees />;
}

function StaffFees() {
  const [classes, setClasses] = useState<ClassRoom[]>([]); const [classId, setClassId] = useState(""); const [overdueOnly, setOverdueOnly] = useState(false);
  const [debts, setDebts] = useState<Debts | null>(null); const [fin, setFin] = useState<Fin | null>(null); const [err, setErr] = useState("");
  const [tab, setTab] = useState<"debts" | "invoices" | "transfers">("debts"); const [ft, setFt] = useState<FeeFeatures | null>(null); const [period, setPeriod] = useState(thisMonth()); const [status, setStatus] = useState("");
  const [invs, setInvs] = useState<Paged<Invoice> | null>(null); const [page, setPage] = useState(1);
  const [gen, setGen] = useState(false); const [genMsg, setGenMsg] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { api.classes().then(setClasses).catch(() => {}); feeFeatures().then(setFt) }, []);
  const load = useCallback(() => {
    const q = new URLSearchParams({ ...(classId ? { classId } : {}), ...(overdueOnly ? { overdueOnly: "true" } : {}) });
    http.get<Debts>("/debts?" + q).then(setDebts).catch(e => setErr(e.message));
    http.get<Fin>(`/reports/finance?fromMonth=${thisMonth()}&toMonth=${thisMonth()}${classId ? "&classId=" + classId : ""}`).then(setFin).catch(() => {});
  }, [classId, overdueOnly]);
  useEffect(() => { load() }, [load]);
  useEffect(() => { if (tab !== "invoices") return; const q = new URLSearchParams({ period, page: String(page), limit: "20", ...(classId ? { classId } : {}), ...(status ? { status } : {}) });
    http.get<Paged<Invoice>>("/invoices?" + q).then(setInvs).catch(e => setErr(e.message)) }, [tab, period, page, classId, status]);
  const nextP = addMonth(thisMonth(), 1); const [genP, setGenP] = useState(nextP);
  async function generate() { setBusy(true); setGenMsg([]);
    try { const r = await http.post<{ created: number; skippedExisting: number; totalAmount: number; warnings: { message: string }[] }>("/invoices/generate", { period: genP, ...(classId ? { classId } : {}) });
      setGenMsg([`Đã tạo ${r.created} hóa đơn ${monthLabel(genP).toLowerCase()} (tổng ${vnd(r.totalAmount)}), bỏ qua ${r.skippedExisting} bé đã có hóa đơn.`, ...r.warnings.map(w => "⚠ " + w.message)]); load() }
    catch (e) { setGenMsg(["❌ " + (e as Error).message]) } finally { setBusy(false) } }
  const cur = fin?.byPeriod.find(p => p.month === thisMonth());
  const stats: { l: string; v: string; sub?: string; c: string; t: string }[] = [
    { l: "Đã thu tháng này", v: cur ? short(cur.collected) : "…", sub: cur ? `trên ${short(cur.invoiced)} phải thu` : undefined, c: "bg-mint-50 text-mint-700", t: "stat-collected" },
    { l: "Còn nợ chưa quá hạn", v: debts ? short(debts.totalDebt - debts.totalOverdue) : "…", sub: debts ? `${debts.childCount} bé còn nợ` : undefined, c: "bg-sun-100 text-peach-600", t: "stat-debt" },
    { l: "Quá hạn (sau ngày 10)", v: debts ? short(debts.totalOverdue) : "…", sub: debts ? `${debts.overdueChildCount} bé` : undefined, c: "bg-rose-100 text-rose-500", t: "stat-overdue" },
    { l: "Số dư trả trước", v: fin ? short(fin.current.totalCreditBalance) : "…", c: "bg-sky-100 text-sky-500", t: "stat-credit" }];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Học phí</h1>
      <div className="flex flex-wrap gap-2"><select className="input !w-auto" value={classId} onChange={e => { setClassId(e.target.value); setPage(1) }} data-testid="fees-class"><option value="">Lớp: Tất cả</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button className="btn" data-testid="btn-open-generate" onClick={() => setGen(!gen)}>⚡ Tạo hóa đơn {monthLabel(genP).replace("Tháng", "tháng")}</button></div></div>
    {gen && <div className="card space-y-2 bg-mint-50"><div className="flex flex-wrap items-end gap-2"><label className="text-sm">Kỳ hóa đơn<input type="month" className="input" value={genP} onChange={e => setGenP(e.target.value)} data-testid="gen-period" /></label>
      <div className="text-sm text-ink-500">{classId ? `Chỉ lớp ${classes.find(c => c.id === classId)?.name}` : "Toàn trường"} · hạn nộp ngày 10 · bé đã có hóa đơn sẽ được bỏ qua, tiền ăn ngày vắng có báo trước được hoàn tự động</div>
      <button className="btn" disabled={busy || !genP} onClick={generate} data-testid="btn-generate">{busy ? "Đang tạo…" : "Tạo hóa đơn"}</button></div>
      {genMsg.map((m, i) => <p key={i} className="text-sm" data-testid="gen-result">{m}</p>)}</div>}
    {err && <p className="text-rose-500">{err}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(s => <div key={s.l} className={`rounded-2xl p-4 ${s.c}`} data-testid={s.t}><div className="text-xs">{s.l}</div><div className="text-xl font-bold md:text-2xl">{s.v}</div>{s.sub && <div className="mt-0.5 text-xs text-ink-500">{s.sub}</div>}</div>)}</div>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap max-sm:[&>button]:px-3 max-sm:[&>button]:text-sm" data-testid="fees-tabs"><button className={`btn ${tab === "debts" ? "" : "!bg-white !text-ink-700"}`} onClick={() => setTab("debts")} data-testid="tab-debts">Công nợ</button>
      <button className={`btn ${tab === "invoices" ? "" : "!bg-white !text-ink-700"}`} onClick={() => setTab("invoices")} data-testid="tab-invoices">Hóa đơn theo tháng</button>
      <button className={`btn ${tab === "transfers" ? "" : "!bg-white !text-ink-700"}`} onClick={() => setTab("transfers")} data-testid="tab-transfers">Đối soát CK{ft && !ft.queue && <span className="ml-1 text-[10px] font-normal">Sắp có</span>}</button></div>
    {tab === "transfers" && (ft?.queue ? <TransferQueue onChanged={load} />
      : <div className="card space-y-1 text-center" data-testid="transfers-soon"><div className="text-2xl">🚧</div><b>Đối soát chuyển khoản: sắp có</b><p className="text-sm text-ink-500">Khi phụ huynh báo đã chuyển khoản qua mã QR, giao dịch sẽ hiện ở đây để kế toán xác nhận hoặc từ chối.</p></div>)}
    {tab === "debts" && <div className="card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Công nợ {debts && <span className="text-sm font-normal text-ink-500">· {debts.childCount} bé còn nợ, tổng {vnd(debts.totalDebt)}</span>}</h2>
        <label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} data-testid="debts-overdue-only" />Chỉ bé quá hạn</label></div>
      {debts?.items.length === 0 && <p className="py-6 text-center text-ink-500">Không có công nợ 🎉</p>}
      <div className="hidden md:block"><table className="w-full text-sm [&_td]:px-2 [&_th]:px-2"><thead className="text-left text-ink-500"><tr><th className="py-2">Bé</th><th>Lớp</th><th className="text-right">Còn nợ</th><th className="text-right">Quá hạn</th><th>Hạn cũ nhất</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>{debts?.items.map(d => <tr key={d.childId} data-testid="debt-row" style={{ verticalAlign: "middle" }} data-overdue={d.overdue} className={`border-t border-ink-100 ${d.overdue ? "bg-rose-100/60" : ""}`}>
          <td className="py-2"><div className="flex items-center gap-2"><Photo id={d.childId} size={32} withdrawn={d.childStatus === "withdrawn"} />{d.fullName}{d.childStatus === "withdrawn" && <WithdrawnBadge />}</div></td><td>{d.className}</td>
          <td className="text-right font-semibold">{vnd(d.balance)}</td><td className="text-right text-rose-500">{d.overdueAmount ? vnd(d.overdueAmount) : "–"}</td><td>{vnDate(d.oldestDueDate)}</td>
          <td><StatusPill inv={{ status: "unpaid", overdue: d.overdue }} /></td>
          <td className="py-1.5 text-right align-middle"><Link href={`/fees/child/${d.childId}`} className="btn inline-flex !min-h-10 items-center justify-center !bg-peach-500 disabled:!bg-ink-100 !py-0 text-xs" data-testid="btn-collect">Ghi thu</Link></td></tr>)}</tbody></table></div>
      {/* B10 (mockups8): 390px card — info row (badge min-w + tabular-nums), full-width "Ghi thu" button below */}
      <div className="space-y-2 md:hidden">{debts?.items.map(d => <div key={d.childId} data-testid="debt-row" data-overdue={d.overdue} className={`rounded-2xl p-3 ${d.overdue ? "bg-rose-100" : "bg-ink-100/40"}`}>
        <Link href={`/fees/child/${d.childId}`} className="flex min-h-12 items-start gap-3">
          <Photo id={d.childId} size={40} withdrawn={d.childStatus === "withdrawn"} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{d.fullName}</div><div className="text-xs text-ink-500">{d.className} · hạn {vnDate(d.oldestDueDate)}</div>
            <div className="mt-0.5 whitespace-nowrap font-bold tabular-nums">{vnd(d.balance)}</div></div>
          {d.overdue && <span className="min-w-[64px] shrink-0 whitespace-nowrap rounded-full bg-white/70 px-2 py-1 text-center text-xs tabular-nums text-rose-500">⚠ Quá hạn</span>}</Link>
        <Link href={`/fees/child/${d.childId}`} className="btn mt-3 flex h-12 w-full items-center justify-center !bg-peach-500 !py-0" data-testid="btn-collect">Ghi thu</Link></div>)}</div>
      {debts && <p className="mt-2 text-xs text-ink-500">{debts.overdueRule}</p>}</div>}
    {tab === "invoices" && <div className="card space-y-3">
      <div className="flex flex-wrap gap-2"><input type="month" className="input !w-auto" value={period} onChange={e => { setPeriod(e.target.value); setPage(1) }} data-testid="inv-period" />
        <select className="input !w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} data-testid="inv-status"><option value="">Mọi trạng thái</option><option value="outstanding">Còn nợ</option><option value="overdue">Quá hạn</option><option value="unpaid">Chưa đóng</option><option value="partial">Đóng một phần</option><option value="paid">Đã đóng</option><option value="void">Đã hủy</option></select></div>
      {invs?.items.length === 0 && <p className="py-6 text-center text-ink-500">Chưa có hóa đơn {monthLabel(period).toLowerCase()}</p>}
      {invs?.items.map(i => <Link key={i.id} href={`/fees/invoice/${i.id}`} data-testid="invoice-row" className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-3 hover:ring-2 hover:ring-mint-300 ${i.overdue && i.status !== "paid" && i.status !== "void" ? "bg-rose-100/60" : "bg-ink-100/30"}`}>
        <span className="w-36 text-xs text-ink-500">{i.invoiceNo}</span><span className="flex-1 font-semibold">{i.childName} <span className="font-normal text-ink-500">· {i.className}</span></span>
        <span className="w-28 text-right">{vnd(i.totalAmount)}</span><span className="w-28 text-right text-ink-500">đã thu {short(i.paidAmount)}</span><StatusPill inv={i} /></Link>)}
      {invs && invs.total > invs.limit && <div className="flex items-center justify-center gap-3"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button><span>Trang {page}/{Math.ceil(invs.total / invs.limit)}</span><button className="btn" disabled={page * invs.limit >= invs.total} onClick={() => setPage(page + 1)}>›</button></div>}</div>}
  </div>;
}

function ParentFees() {
  const [kids, setKids] = useState<Child[]>([]); const [invs, setInvs] = useState<Invoice[]>([]);
  useEffect(() => { api.children({ limit: 20 }).then(p => setKids(p.items)); http.get<Paged<Invoice>>("/invoices?limit=50").then(p => setInvs(p.items)).catch(() => {}) }, []);
  return <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-bold">Học phí của bé</h1>
    {kids.map(k => <ChildFeeSummary key={k.id} child={k} invoices={invs.filter(i => i.childId === k.id)} />)}</div>;
}
function ChildFeeSummary({ child, invoices }: { child: Child; invoices: Invoice[] }) {
  const [bal, setBal] = useState<{ balance: number; creditBalance: number; overdueAmount: number } | null>(null);
  useEffect(() => { http.get<typeof bal>(`/children/${child.id}/balance`).then(setBal).catch(() => {}) }, [child.id]);
  return <div className="card space-y-3"><div className="flex items-center gap-3"><Photo url={child.photoUrl} id={child.id} size={48} withdrawn={child.status === "withdrawn"} /><div className="flex-1"><b>{child.fullName}</b><div className="text-sm text-ink-500">{child.className}</div></div>
    {bal && <div className="text-right"><div className={`text-xl font-bold ${bal.balance > 0 ? "text-rose-500" : "text-mint-700"}`} data-testid="parent-balance">{bal.balance > 0 ? vnd(bal.balance) : "Đã đóng đủ"}</div>
      {bal.creditBalance > 0 && <div className="text-xs text-sky-500">Số dư trả trước {vnd(bal.creditBalance)}</div>}{bal.overdueAmount > 0 && <div className="text-xs text-rose-500">Quá hạn {vnd(bal.overdueAmount)}</div>}</div>}</div>
    {invoices.map(i => { const open = (i.status === "unpaid" || i.status === "partial") && i.balance > 0; const pend = open && i.paymentStatus === "pending_confirmation";
      return <div key={i.id} className={`flex min-h-12 items-center gap-2 rounded-2xl p-1 pr-2 ${i.overdue && i.status !== "paid" && i.status !== "void" ? "bg-rose-100/60" : "bg-ink-100/30"}`} data-testid="invoice-row">
        <Link href={`/fees/invoice/${i.id}`} className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-2">
          <span>{monthLabel(i.period)} <span className="text-xs text-ink-500">· hạn {vnDate(i.dueDate)}</span></span><span className="flex items-center gap-2"><b>{vnd(i.totalAmount)}</b><StatusPill inv={pend ? { ...i, paymentStatus: null } : i} /></span></Link>
        {pend ? <span className="shrink-0 rounded-full bg-sun-100 px-3 py-1 text-xs font-semibold text-ink-700" data-testid="row-pending">⏳ Chờ xác nhận</span>
          : open && <Link href={`/fees/invoice/${i.id}#qr`} className="flex min-h-12 shrink-0 items-center rounded-full bg-mint-500 px-3 text-sm font-semibold text-white" data-testid="btn-pay">Thanh toán ›</Link>}</div> })}
    {invoices.length === 0 && <p className="text-sm text-ink-500">Chưa có hóa đơn</p>}</div>;
}
