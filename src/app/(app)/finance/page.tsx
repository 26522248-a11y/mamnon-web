"use client";
/** Thu chi tổng (mockups9) cho BGH và kế toán. API /finance/*. Học phí tự cộng; khoản chi > 10tr của kế toán chờ BGH duyệt. */
import { useCallback, useEffect, useState } from "react";
import { DateField } from "@/components/DateField";
import { api, todayStr } from "@/lib/api";
import { APPROVAL_LIMIT, Category, createEntry, decideEntry, Finance, getCategories, getFinance, openReceipt, Txn } from "@/lib/finance-api";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Có lỗi, thử lại";
const shiftMonth = (m: string, n: number) => { const d = new Date(m + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7) };
const STATUS: Record<string, string> = { rejected: "bị từ chối", void: "đã huỷ" };

function AddExpense({ onDone, onClose, isAdmin }: { onDone: (m: string) => void; onClose: () => void; isAdmin: boolean }) {
  const [cats, setCats] = useState<Category[]>([]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ kind: "out" as "in" | "out", date: todayStr(), title: "", amount: "", categoryId: "", note: "" }); const [file, setFile] = useState<File | null>(null);
  useEffect(() => { getCategories().then(setCats).catch(e => setErr(errMsg(e))) }, []);
  const amount = Number(f.amount.replace(/\D/g, "")) || 0;
  const needsApproval = f.kind === "out" && amount > APPROVAL_LIMIT && !isAdmin;
  const save = async () => { setBusy(true); setErr("");
    try { const r = await createEntry({ kind: f.kind, date: f.date, title: f.title.trim(), amount, categoryId: f.categoryId, note: f.note.trim() || undefined }, file);
      onDone(r.status === "pending" ? "Đã ghi khoản chi – đang chờ Ban giám hiệu duyệt" : f.kind === "in" ? "Đã ghi khoản thu" : "Đã ghi khoản chi") } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-label="Ghi khoản chi" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={e => e.stopPropagation()} data-testid="finance-form">
      <div className="flex gap-2">{(["out", "in"] as const).map(k => <button key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k, categoryId: "" })}
        className={`min-h-12 flex-1 rounded-xl font-semibold ${f.kind === k ? (k === "out" ? "bg-rose-500 text-white" : "bg-mint-500 text-white") : "bg-ink-100"}`}>{k === "out" ? "Khoản chi" : "Thu khác"}</button>)}</div>
      <input className="input min-h-12 w-full" placeholder="Nội dung (vd. Mua rau, thịt tuần 2)" aria-label="Nội dung" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <input className="input min-h-12 w-full tabular-nums" inputMode="numeric" placeholder="Số tiền (đ)" aria-label="Số tiền" value={amount ? amount.toLocaleString("vi-VN") : ""} onChange={e => setF({ ...f, amount: e.target.value })} />
      <select className="input min-h-12 w-full" aria-label="Nhóm" value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}>
        <option value="">— Nhóm —</option>{cats.filter(c => c.kind === f.kind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label className="block text-xs text-ink-500">Ngày<DateField value={f.date} max={todayStr()} onChange={v => setF({ ...f, date: v })} aria-label="Ngày" /></label>
      <label className="block text-xs text-ink-500">📎 Hoá đơn (ảnh hoặc PDF, ≤ 5MB)<input type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <textarea className="input w-full" rows={2} placeholder="Ghi chú" aria-label="Ghi chú" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
      {needsApproval && <p className="rounded-xl bg-sun-100 p-2 text-xs">⏳ Khoản chi trên 10 triệu sẽ chờ Ban giám hiệu duyệt trước khi tính vào tổng chi.</p>}
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
      <div className="flex gap-2"><button className="min-h-12 flex-1 rounded-xl border border-ink-100" onClick={onClose}>Huỷ</button>
        <button className="btn min-h-12 flex-1" disabled={busy || f.title.trim().length < 2 || amount < 1000 || !f.categoryId || !f.date} onClick={save} data-testid="finance-save">{busy ? "Đang lưu…" : "Lưu"}</button></div>
    </div></div>;
}

const tr = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr";
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const dm = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const BAR = ["bg-rose-500", "bg-peach-500", "bg-sun-500", "bg-sky-500"];

export default function FinancePage() {
  const role = api.me()?.role;
  const [f, setF] = useState<Finance | null>(null); const [kind, setKind] = useState<"" | "in" | "out">("");
  const [month, setMonth] = useState(() => todayStr().slice(0, 7)); const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [adding, setAdding] = useState(false);
  const allowed = role === "admin" || role === "accountant";
  const load = useCallback(() => { if (allowed) getFinance(month).then(x => { setF(x); setErr("") }).catch(e => setErr(errMsg(e))) }, [month, allowed]);
  useEffect(load, [load]);
  const decide = async (t: Txn, action: "approve" | "reject") => {
    const note = action === "reject" ? window.prompt("Lý do từ chối") : undefined; if (action === "reject" && !note?.trim()) return;
    try { await decideEntry(t.id, action, note ?? undefined); setMsg(action === "approve" ? `Đã duyệt: ${t.title}` : `Đã từ chối: ${t.title}`); load() } catch (e) { setErr(errMsg(e)) } };
  if (!allowed) return <p className="text-ink-500">Chỉ Ban giám hiệu và kế toán xem thu chi.</p>;
  if (!f) return err ? <p className="text-rose-500" role="alert">{err}</p> : <p className="text-ink-500">Đang tải…</p>;
  const openAdd = () => { setMsg(""); setAdding(true) };
  const diff = f.totalIn - f.totalOut; const maxG = Math.max(1, ...f.groups.map(g => g.amount));
  const txns = f.txns.filter(t => !kind || t.kind === kind);
  return <div className="mx-auto max-w-5xl space-y-4" data-testid="finance-page">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-ink-500">{role === "admin" ? "Ban giám hiệu" : "Kế toán"} · Tài chính</p><h1 className="text-2xl font-bold"><button aria-label="Tháng trước" className="pr-1" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>Thu chi tháng {f.month.slice(5)}/{f.month.slice(0, 4)}{month < todayStr().slice(0, 7) && <button aria-label="Tháng sau" className="pl-1" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>}</h1></div>
      <button onClick={openAdd} className="hidden min-h-12 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white sm:block">+ Ghi chi</button></div>
    {msg && <p className="rounded-xl bg-mint-50 p-3 text-sm text-mint-700" role="status" data-testid="finance-msg">{msg}</p>}
    {err && <p className="rounded-xl bg-rose-100 p-3 text-sm text-rose-600" role="alert">{err}</p>}
    {!!f.pending?.count && <p className="rounded-xl bg-sun-100 p-3 text-sm">⏳ {f.pending.count} khoản chi chờ Ban giám hiệu duyệt · {vnd(f.pending.amount)}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-mint-50 p-3 sm:p-4"><p className="text-xs text-mint-700">Tổng thu</p><b className="text-xl text-mint-700 tabular-nums sm:text-2xl">{tr(f.totalIn)}</b><p className="hidden text-xs text-ink-500 sm:block">{f.inBreakdown}</p></div>
      <div className="rounded-2xl bg-rose-100 p-3 sm:p-4"><p className="text-xs text-rose-600">Tổng chi</p><b className="text-xl text-rose-600 tabular-nums sm:text-2xl">{tr(f.totalOut)}</b><p className="hidden text-xs text-ink-500 sm:block">{f.outBreakdown}</p></div>
      <div className="col-span-2 flex items-center justify-between rounded-2xl bg-sky-100 p-3 sm:col-span-1 sm:block sm:p-4"><p className="text-xs text-sky-500">Chênh lệch</p><b className="text-xl text-sky-500 tabular-nums sm:text-2xl">{diff >= 0 ? "+" : "−"}{tr(Math.abs(diff))}</b><p className="hidden text-xs text-ink-500 sm:block">so tháng trước: {f.prevDiffPct >= 0 ? "+" : ""}{f.prevDiffPct.toLocaleString("vi-VN")}%</p></div></div>
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <div className="card hidden sm:block"><p className="mb-2 text-xs font-semibold text-ink-500">CHI THEO NHÓM</p><div className="space-y-2 text-sm">{!f.groups.length && <p className="text-ink-500">Chưa có khoản chi</p>}{f.groups.map((g, i) => <div key={g.name}><div className="flex justify-between"><span>{g.name}</span><b className="tabular-nums">{tr(g.amount)}</b></div><div className="h-2 rounded-full bg-ink-100"><div className={`h-2 rounded-full ${BAR[i % 4]}`} style={{ width: `${(g.amount / maxG) * 100}%` }} /></div></div>)}</div></div>
      <div className="card !p-3 sm:!p-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-ink-500">GIAO DỊCH GẦN ĐÂY</p>
        <div className="flex gap-1 text-xs">{([["", "Tất cả"], ["in", "Thu"], ["out", "Chi"]] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`min-h-9 rounded-full px-3 ${kind === k ? "bg-mint-500 font-semibold text-white" : "bg-ink-100"}`}>{l}</button>)}</div></div>
        <div className="divide-y divide-ink-100 text-sm">{!txns.length && <p className="py-3 text-ink-500">Chưa có giao dịch</p>}{txns.map(t => <div key={t.id} className={`flex items-center justify-between gap-2 py-2 ${t.status === "void" || t.status === "rejected" ? "opacity-50" : ""}`}><div className="min-w-0"><b className={`block truncate ${t.status === "void" ? "line-through" : ""}`}>{t.title}</b>
          <p className="text-xs text-ink-500">{dm(t.date)}{t.auto ? " · tự động" : t.by ? ` · ${t.by}` : ""}{t.hasReceipt && t.receiptUrl ? <> · <button className="underline" onClick={() => openReceipt(t.receiptUrl!)}>📎 hoá đơn</button></> : t.hasReceipt ? " · 📎 hoá đơn" : ""}{t.pending && <span className="ml-1 whitespace-nowrap rounded-full bg-sun-100 px-1.5 text-ink-900">⏳ chờ Ban giám hiệu duyệt</span>}{t.status && STATUS[t.status] && <span className="ml-1">· {STATUS[t.status]}</span>}</p>
          {t.pending && role === "admin" && <div className="mt-1 flex gap-2"><button className="min-h-9 rounded-lg bg-mint-500 px-3 text-xs font-semibold text-white" onClick={() => decide(t, "approve")} data-testid="fin-approve">Duyệt</button><button className="min-h-9 rounded-lg bg-ink-100 px-3 text-xs" onClick={() => decide(t, "reject")}>Từ chối</button></div>}</div>
          <b className={`shrink-0 tabular-nums ${t.kind === "in" ? "text-mint-700" : "text-rose-500"}`}><span className="sm:hidden">{t.kind === "in" ? "+" : "−"}{tr(t.amount)}</span><span className="hidden sm:inline">{t.kind === "in" ? "+" : "−"}{vnd(t.amount)}</span></b></div>)}</div></div></div>
    <button onClick={openAdd} className="min-h-12 w-full rounded-xl bg-rose-500 font-semibold text-white sm:hidden">+ Ghi khoản chi</button>
    {adding && <AddExpense isAdmin={role === "admin"} onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); setMsg(m); load() }} />}
    <p className="text-xs text-ink-500">Học phí tự cộng từ mục Học phí. Khoản chi trên 10 triệu cần Ban giám hiệu duyệt.</p>
  </div>;
}
