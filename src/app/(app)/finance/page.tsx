"use client";
/** Thu chi tổng (mockups9) cho BGH và kế toán. Dữ liệu mẫu. Khoản chi > 10tr cần BGH duyệt. */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Finance, getFinance } from "@/lib/finance-api";

const tr = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr";
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const dm = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const BAR = ["bg-rose-500", "bg-peach-500", "bg-sun-500", "bg-sky-500"];

export default function FinancePage() {
  const role = api.me()?.role;
  const [f, setF] = useState<Finance | null>(null); const [kind, setKind] = useState<"" | "in" | "out">("");
  useEffect(() => { getFinance().then(setF) }, []);
  if (role !== "admin" && role !== "accountant") return <p className="text-ink-500">Chỉ Ban giám hiệu và kế toán xem thu chi.</p>;
  if (!f) return <p className="text-ink-500">Đang tải…</p>;
  const diff = f.totalIn - f.totalOut; const maxG = Math.max(...f.groups.map(g => g.amount));
  const txns = f.txns.filter(t => !kind || t.kind === kind);
  return <div className="mx-auto max-w-5xl space-y-4" data-testid="finance-page">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-ink-500">{role === "admin" ? "BGH" : "Kế toán"} · Tài chính</p><h1 className="text-2xl font-bold">Thu chi tháng {f.month.slice(5)}/{f.month.slice(0, 4)}</h1></div>
      <button className="hidden min-h-12 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white sm:block">+ Ghi chi</button></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-mint-50 p-3 sm:p-4"><p className="text-xs text-mint-700">Tổng thu</p><b className="text-xl text-mint-700 tabular-nums sm:text-2xl">{tr(f.totalIn)}</b><p className="hidden text-xs text-ink-500 sm:block">{f.inBreakdown}</p></div>
      <div className="rounded-2xl bg-rose-100 p-3 sm:p-4"><p className="text-xs text-rose-600">Tổng chi</p><b className="text-xl text-rose-600 tabular-nums sm:text-2xl">{tr(f.totalOut)}</b><p className="hidden text-xs text-ink-500 sm:block">{f.outBreakdown}</p></div>
      <div className="col-span-2 flex items-center justify-between rounded-2xl bg-sky-100 p-3 sm:col-span-1 sm:block sm:p-4"><p className="text-xs text-sky-500">Chênh lệch</p><b className="text-xl text-sky-500 tabular-nums sm:text-2xl">{diff >= 0 ? "+" : "−"}{tr(Math.abs(diff))}</b><p className="hidden text-xs text-ink-500 sm:block">so tháng trước: {f.prevDiffPct >= 0 ? "+" : ""}{f.prevDiffPct}%</p></div></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card hidden sm:block"><p className="mb-2 text-xs font-semibold text-ink-500">CHI THEO NHÓM</p><div className="space-y-2 text-sm">{f.groups.map((g, i) => <div key={g.name}><div className="flex justify-between"><span>{g.name}</span><b className="tabular-nums">{tr(g.amount)}</b></div><div className="h-2 rounded-full bg-ink-100"><div className={`h-2 rounded-full ${BAR[i % 4]}`} style={{ width: `${(g.amount / maxG) * 100}%` }} /></div></div>)}</div></div>
      <div className="card !p-3 sm:!p-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-ink-500">GIAO DỊCH GẦN ĐÂY</p>
        <div className="flex gap-1 text-xs">{([["", "Tất cả"], ["in", "Thu"], ["out", "Chi"]] as const).map(([k, l]) => <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`min-h-9 rounded-full px-3 ${kind === k ? "bg-mint-500 font-semibold text-white" : "bg-ink-100"}`}>{l}</button>)}</div></div>
        <div className="divide-y divide-ink-100 text-sm">{txns.map(t => <div key={t.id} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><b className="block truncate">{t.title}</b>
          <p className="text-xs text-ink-500">{dm(t.date)}{t.auto ? " · tự động" : t.by ? ` · ${t.by}` : ""}{t.hasReceipt && " · 📎 hoá đơn"}{t.pending && <span className="ml-1 rounded-full bg-sun-100 px-1.5 text-ink-900">⏳ chờ BGH duyệt</span>}</p></div>
          <b className={`shrink-0 tabular-nums ${t.kind === "in" ? "text-mint-700" : "text-rose-500"}`}><span className="sm:hidden">{t.kind === "in" ? "+" : "−"}{tr(t.amount)}</span><span className="hidden sm:inline">{t.kind === "in" ? "+" : "−"}{vnd(t.amount)}</span></b></div>)}</div></div></div>
    <button className="min-h-12 w-full rounded-xl bg-rose-500 font-semibold text-white sm:hidden">+ Ghi khoản chi</button>
    <p className="text-xs text-ink-500">Học phí tự cộng từ mục Học phí. Khoản chi trên 10 triệu cần BGH duyệt.</p>
  </div>;
}
