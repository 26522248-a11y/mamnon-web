"use client";
// Báo cáo (mockups4): Chuyên cần · Sĩ số (admin) · Thu chi (admin + kế toán). Xuất Excel = file .xlsx do API tạo.
import { useEffect, useMemo, useState } from "react";
import { api, http } from "@/lib/api";
import { addMonth, monthLabel, short, thisMonth, vnd, vnDate } from "@/lib/fmt";

type AttItem = { classId: string; className: string; month: string; recorded: number; present: number; late: number; absent: number; absentNotified: number; schoolDays: number; attendanceRate: number | null; low: boolean };
type AttReport = { fromMonth: string; toMonth: string; lowThreshold: number; totals: { recorded: number; attended: number; absent: number; attendanceRate: number | null }; items: AttItem[] };
type EnrClass = { classId: string; className: string; ageGroup: string; capacity: number | null; active: number; male: number; female: number; fillRate: number | null };
type EnrReport = { asOf: string; totals: { active: number; withdrawn: number; unassigned: number; capacity: number; fillRate: number | null }; byClass: EnrClass[]; newEnrollmentsByMonth: { month: string; enrolled: number }[] };
type FinPeriod = { month: string; invoiceCount: number; invoiced: number; collected: number; outstanding: number; overdue: number; collectionRate: number | null; paid: number; partial: number; unpaid: number; deductions: { discount: number; refund: number; credit: number } };
type FinReport = { fromMonth: string; toMonth: string; asOf: string; current: { totalDebt: number; totalOverdue: number; totalCreditBalance: number }; byPeriod: FinPeriod[];
  cashFlowByMonth: { month: string; income: number; expense: number; net: number; receipts: number; vouchers: number }[] };
type Tab = "attendance" | "enrollment" | "finance";

const TABS: { key: Tab; label: string; roles: string[] }[] = [
  { key: "attendance", label: "Chuyên cần", roles: ["admin"] },
  { key: "enrollment", label: "Sĩ số", roles: ["admin"] },
  { key: "finance", label: "Thu chi", roles: ["admin", "accountant"] },
];
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);

export default function ReportsPage() {
  const me = api.me();
  const tabs = TABS.filter(t => me && t.roles.includes(me.role));
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? "finance");
  const [month, setMonth] = useState(thisMonth());
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonth(thisMonth(), -i)), []);
  const [att, setAtt] = useState<AttReport | null>(null);
  const [enr, setEnr] = useState<EnrReport | null>(null);
  const [fin, setFin] = useState<FinReport | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const isAdmin = me?.role === "admin";
  const finFrom = addMonth(month, -5);

  useEffect(() => {
    setErr("");
    const fail = (e: Error) => setErr(e.message);
    if (tab === "attendance") {
      setAtt(null); http.get<AttReport>(`/reports/attendance?fromMonth=${month}&toMonth=${month}`).then(setAtt).catch(fail);
      if (isAdmin) http.get<FinReport>(`/reports/finance?fromMonth=${month}&toMonth=${month}`).then(setFin).catch(() => {});
    }
    if (tab === "enrollment") { setEnr(null); http.get<EnrReport>("/reports/enrollment").then(setEnr).catch(fail); }
    if (tab === "finance") { setFin(null); http.get<FinReport>(`/reports/finance?fromMonth=${finFrom}&toMonth=${month}`).then(setFin).catch(fail); }
  }, [tab, month, isAdmin, finFrom]);

  async function exportXlsx() {
    setBusy(true); setErr("");
    const url = tab === "attendance" ? `/api/v1/reports/attendance/export?fromMonth=${month}&toMonth=${month}`
      : tab === "enrollment" ? "/api/v1/reports/enrollment/export" : `/api/v1/reports/finance/export?fromMonth=${finFrom}&toMonth=${month}`;
    const name = tab === "attendance" ? `chuyen-can_${month}.xlsx` : tab === "enrollment" ? `si-so_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })}.xlsx` : `thu-chi_${finFrom}_${month}.xlsx`;
    try {
      const blob = await http.blobUrl(url);
      if (!blob) throw new Error("Không xuất được file Excel");
      const a = document.createElement("a"); a.href = blob; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(blob), 5000);
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (!tabs.length) return <p className="text-ink-500">Bạn không có quyền xem báo cáo.</p>;
  return <section className="card p-5 md:p-6">
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <h1 className="text-2xl font-bold">Báo cáo</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)}
          className={`min-h-11 rounded-xl px-4 py-2 font-medium ${tab === t.key ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-900 hover:bg-mint-50"}`}>{t.label}</button>)}
        {tab !== "enrollment" && <select aria-label="Chọn tháng" value={month} onChange={e => setMonth(e.target.value)} className="min-h-11 rounded-xl border border-ink-300 bg-white px-3">
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>}
        <button onClick={exportXlsx} disabled={busy} className="min-h-11 rounded-xl border border-ink-300 bg-white px-4 py-2 font-medium hover:bg-mint-50 disabled:opacity-50">
          {busy ? "Đang xuất…" : "⬇ Xuất Excel"}</button>
      </div>
    </div>
    {err && <p role="alert" className="mb-3 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-500">{err}</p>}
    {tab === "attendance" && <AttendanceTab data={att} fin={isAdmin ? fin : null} month={month} />}
    {tab === "enrollment" && <EnrollmentTab data={enr} />}
    {tab === "finance" && <FinanceTab data={fin} month={month} />}
  </section>;
}

function Loading() { return <p className="py-10 text-center text-ink-500">Đang tải…</p> }
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return <div className={`rounded-2xl p-4 ${tone}`}><p className="text-[13px] text-ink-700">{label}</p><p className="text-2xl font-bold">{value}</p>{sub && <p className="text-[13px] text-ink-500">{sub}</p>}</div>;
}

function AttendanceTab({ data, fin, month }: { data: AttReport | null; fin: FinReport | null; month: string }) {
  if (!data) return <Loading />;
  const items = data.items.filter(i => i.month === month);
  const low = items.filter(i => i.low).sort((a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0));
  const flow = fin?.cashFlowByMonth.find(x => x.month === month);
  const W = Math.max(items.length, 1) * 100;
  return <div className="grid gap-6 lg:grid-cols-3">
    <div className="lg:col-span-2">
      <p className="mb-2 text-sm text-ink-500">Tỷ lệ chuyên cần theo lớp (%) · <span className="text-peach-500">cam</span> = dưới {data.lowThreshold}%</p>
      {items.length === 0 ? <p className="rounded-2xl bg-ink-100 p-6 text-center text-ink-500">Chưa có dữ liệu điểm danh trong {monthLabel(month).toLowerCase()}.</p> :
        <svg viewBox={`0 0 ${W} 220`} className="h-64 w-full" role="img" aria-label="Biểu đồ tỷ lệ chuyên cần theo lớp">
          {[0, 50, 100].map(v => <line key={v} x1="0" x2={W} y1={180 - v * 1.5} y2={180 - v * 1.5} stroke="#EEF1F5" />)}
          {items.map((i, k) => { const h = (i.attendanceRate ?? 0) * 1.5; const x = k * 100 + 25;
            return <g key={i.classId}>
              <rect x={x} y={180 - h} width="50" height={h} rx="10" fill={i.low ? "#FF8A4C" : "#2EBF91"}><title>{`${i.className}: ${pct(i.attendanceRate)}`}</title></rect>
              <text x={x + 25} y={172 - h} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1F2A37">{pct(i.attendanceRate)}</text>
              <text x={x + 25} y="200" textAnchor="middle" fontSize="13" fill="#6B7A8C">{i.className}</text></g> })}
        </svg>}
      {items.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-ink-500"><tr><th className="py-2">Lớp</th><th>Ngày học</th><th>Có mặt</th><th>Đi muộn</th><th>Vắng</th><th>Vắng có báo</th><th className="text-right">Tỷ lệ</th></tr></thead>
        <tbody>{items.map(i => <tr key={i.classId} className={`border-t border-ink-100 ${i.low ? "bg-peach-50" : ""}`}>
          <td className="py-2 font-medium">{i.className}</td><td>{i.schoolDays}</td><td>{i.present}</td><td>{i.late}</td><td>{i.absent}</td><td>{i.absentNotified}</td>
          <td className={`text-right font-semibold ${i.low ? "text-peach-600" : "text-mint-700"}`}>{pct(i.attendanceRate)}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="space-y-3">
      <Stat label="Chuyên cần TB" value={pct(items.length ? Math.round(items.reduce((s, i) => s + i.present + i.late, 0) / Math.max(1, items.reduce((s, i) => s + i.recorded, 0)) * 1000) / 10 : null)} tone="bg-mint-50" />
      <Stat label="Lớp cần chú ý" value={low.length ? low.map(l => `${l.className} · ${pct(l.attendanceRate)}`).join(", ") : "Không có"} sub={low.length ? `Dưới ${data.lowThreshold}%` : `Tất cả lớp ≥ ${data.lowThreshold}%`} tone="bg-peach-100" />
      {fin ? <Stat label="Thu / Chi tháng" value={`${short(flow?.income ?? 0)} / ${short(flow?.expense ?? 0)}`} tone="bg-sky-100" /> : null}
    </div>
  </div>;
}

function EnrollmentTab({ data }: { data: EnrReport | null }) {
  if (!data) return <Loading />;
  const t = data.totals;
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Đang học" value={String(t.active)} sub={`Tính đến ${vnDate(data.asOf)}`} tone="bg-mint-50" />
      <Stat label="Sức chứa · lấp đầy" value={`${t.capacity} · ${pct(t.fillRate)}`} tone="bg-sky-100" />
      <Stat label="Đã nghỉ học" value={String(t.withdrawn)} tone="bg-peach-100" />
      <Stat label="Chưa xếp lớp" value={String(t.unassigned)} tone="bg-sun-100" />
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
      <thead className="text-left text-ink-500"><tr><th className="py-2">Lớp</th><th>Khối</th><th>Nam</th><th>Nữ</th><th>Sĩ số / sức chứa</th><th className="w-1/3">Lấp đầy</th></tr></thead>
      <tbody>{data.byClass.map(c => <tr key={c.classId} className="border-t border-ink-100">
        <td className="py-2 font-medium">{c.className}</td><td>{c.ageGroup}</td><td>{c.male}</td><td>{c.female}</td><td>{c.active} / {c.capacity ?? "–"}</td>
        <td><div className="flex items-center gap-2"><div className="h-3 flex-1 rounded-full bg-ink-100"><div className="h-3 rounded-full bg-mint-500" style={{ width: `${Math.min(100, c.fillRate ?? 0)}%` }} /></div><span className="w-12 text-right">{pct(c.fillRate)}</span></div></td>
      </tr>)}</tbody></table></div>
    {data.newEnrollmentsByMonth.length > 0 && <div><p className="mb-2 text-sm text-ink-500">Nhập học mới 12 tháng gần đây</p>
      <div className="flex flex-wrap gap-2">{data.newEnrollmentsByMonth.map(m => <span key={m.month} className="rounded-xl bg-ink-100 px-3 py-2 text-sm">{monthLabel(m.month)}: <b>{m.enrolled}</b></span>)}</div></div>}
  </div>;
}

function FinanceTab({ data, month }: { data: FinReport | null; month: string }) {
  if (!data) return <Loading />;
  const p = data.byPeriod.find(x => x.month === month);
  const flow = data.cashFlowByMonth.find(x => x.month === month);
  const rows = Array.from(new Set([...data.byPeriod.map(x => x.month), ...data.cashFlowByMonth.map(x => x.month)])).sort().reverse();
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={`Phải thu ${monthLabel(month).toLowerCase()}`} value={vnd(p?.invoiced)} sub={`${p?.invoiceCount ?? 0} hoá đơn`} tone="bg-mint-50" />
      <Stat label="Đã thu" value={vnd(p?.collected)} sub={`Tỷ lệ thu ${pct(p?.collectionRate)}`} tone="bg-mint-100" />
      <Stat label="Thu / Chi trong tháng" value={`${short(flow?.income ?? 0)} / ${short(flow?.expense ?? 0)}`} sub={`${flow?.receipts ?? 0} phiếu thu · ${flow?.vouchers ?? 0} phiếu chi`} tone="bg-sky-100" />
      <Stat label="Công nợ hiện tại" value={vnd(data.current.totalDebt)} sub={`Quá hạn ${vnd(data.current.totalOverdue)}`} tone={data.current.totalOverdue > 0 ? "bg-peach-100" : "bg-ink-100"} />
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
      <thead className="text-left text-ink-500"><tr><th className="py-2">Tháng</th><th className="text-right">Phải thu</th><th className="text-right">Đã thu</th><th className="text-right">Còn nợ</th><th className="text-right">Quá hạn</th><th className="text-right">Giảm trừ + hoàn</th><th className="text-right">Thu (tiền vào)</th><th className="text-right">Chi (phiếu chi)</th></tr></thead>
      <tbody>{rows.map(m => { const x = data.byPeriod.find(r => r.month === m); const f = data.cashFlowByMonth.find(r => r.month === m);
        return <tr key={m} className={`border-t border-ink-100 ${m === month ? "bg-mint-50" : ""}`}>
          <td className="py-2 font-medium">{monthLabel(m)}</td><td className="text-right">{vnd(x?.invoiced)}</td><td className="text-right">{vnd(x?.collected)}</td>
          <td className="text-right">{vnd(x?.outstanding)}</td><td className={`text-right ${x?.overdue ? "font-semibold text-peach-600" : ""}`}>{vnd(x?.overdue)}</td>
          <td className="text-right">{vnd((x?.deductions.discount ?? 0) + (x?.deductions.refund ?? 0))}</td>
          <td className="text-right text-mint-700">{vnd(f?.income)}</td><td className="text-right text-rose-500">{vnd(f?.expense)}</td></tr> })}</tbody></table></div>
    <p className="text-[13px] text-ink-500">Số dư trả trước / trả thừa của phụ huynh: {vnd(data.current.totalCreditBalance)} · Hiển thị {monthLabel(data.fromMonth).toLowerCase()} → {monthLabel(data.toMonth).toLowerCase()}</p>
  </div>;
}
