"use client";
/** Quản lý giáo viên (mockups9): BGH xem bảng công tuần + trông thay; giáo viên chấm công của mình. Dữ liệu mẫu. */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AttDay, getMyToday, getStaffWeek, MyToday, ST_UI, StaffWeek } from "@/lib/staff-api";

const WD = ["T2", "T3", "T4", "T5", "T6"];
const dm = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const Cell = ({ d }: { d: AttDay }) => { const u = ST_UI[d.status];
  return <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs tabular-nums ${u.cls}`}>{d.status === "sub" ? `↔ ${d.subClass}` : d.checkIn ?? u.label}</span> };

function AdminView() {
  const [w, setW] = useState<StaffWeek | null>(null);
  useEffect(() => { getStaffWeek().then(setW) }, []);
  if (!w) return <p className="text-ink-500">Đang tải…</p>;
  const s = w.summary;
  return <div className="mx-auto max-w-5xl space-y-4" data-testid="staff-admin">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-ink-500">BGH · Nhân sự</p><h1 className="text-2xl font-bold">Chấm công & ca làm <span className="block text-sm font-semibold text-ink-500 sm:inline sm:text-lg"><span className="hidden sm:inline">· </span>{dm(w.from)}–{dm(w.to)}</span></h1></div>
      <div className="flex gap-2"><button className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-sm font-semibold">⬇ Xuất bảng công</button><button className="btn text-sm">+ Xếp ca</button></div></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-2xl bg-mint-50 p-3"><p className="text-xs text-mint-700">Có mặt hôm nay</p><b className="text-2xl text-mint-700 tabular-nums">{s.present}/{s.total}</b></div>
      <div className="rounded-2xl bg-sun-100 p-3"><p className="text-xs">Đi muộn tuần</p><b className="text-2xl tabular-nums">{s.lateWeek}</b></div>
      <div className="rounded-2xl bg-sky-100 p-3"><p className="text-xs text-sky-500">Nghỉ phép</p><b className="text-2xl text-sky-500 tabular-nums">{s.onLeave}</b></div>
      <div className="rounded-2xl bg-peach-100 p-3"><p className="text-xs text-peach-500">Cần trông thay</p><b className="text-2xl text-peach-500">{s.needSub} lớp</b></div></div>
    {w.subs.filter(x => !x.substitute).map(x => <div key={x.date + x.className} className="flex flex-col gap-3 rounded-2xl border-2 border-peach-300 bg-peach-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="sub-alert">
      <div><b className="text-peach-600">⚠ {dm(x.date)}: {x.className} thiếu giáo viên</b><p className="mt-1 text-xs text-ink-500">{x.absent} {x.reason} · {x.kids} bé · gợi ý: {x.suggestions.join(", ")}</p></div>
      <button className="min-h-12 shrink-0 rounded-xl bg-peach-500 px-4 font-semibold text-white">Phân trông thay</button></div>)}
    <div className="card hidden sm:block"><table className="w-full text-sm"><thead className="text-left text-xs text-ink-500"><tr><th className="py-2">Giáo viên</th>{WD.map(d => <th key={d}>{d}</th>)}<th>Công</th></tr></thead>
      <tbody className="divide-y divide-ink-100">{w.rows.map(r => <tr key={r.id} className={r.leaveDays ? "bg-peach-50" : ""}><td className="py-3"><b>{r.name}</b><br /><span className="text-xs text-ink-500">{r.className} · {r.shift}</span></td>
        {r.days.map(d => <td key={d.date}><Cell d={d} /></td>)}<td className="font-semibold">{r.workDays}{r.leaveDays > 0 && <span className="ml-1 text-xs text-sky-500">+{r.leaveDays}P</span>}</td></tr>)}</tbody></table></div>
    <div className="space-y-2 sm:hidden">{w.rows.map(r => <div key={r.id} className="card !p-3"><div className="flex justify-between"><div className="min-w-0"><b className="block truncate">{r.name}</b><p className="text-xs text-ink-500">{r.className} · {r.shift}</p></div><b className="shrink-0">{r.workDays} công{r.leaveDays > 0 && <span className="text-xs text-sky-500"> +{r.leaveDays}P</span>}</b></div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">{r.days.map((d, i) => <div key={d.date} className={`rounded-lg py-1.5 ${ST_UI[d.status].cls}`}>{WD[i]}<br />{d.status === "sub" ? "↔" : d.checkIn ?? ST_UI[d.status].label}</div>)}</div></div>)}</div>
  </div>;
}

function TeacherView() {
  const [m, setM] = useState<MyToday | null>(null); const [now, setNow] = useState("");
  useEffect(() => { getMyToday().then(setM); const t = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })); t(); const id = setInterval(t, 15000); return () => clearInterval(id) }, []);
  if (!m) return <p className="text-ink-500">Đang tải…</p>;
  const inShift = !!m.checkIn && !m.checkOut;
  return <div className="mx-auto max-w-md space-y-3" data-testid="staff-teacher">
    <h1 className="text-2xl font-bold">Chấm công hôm nay</h1>
    <div className="card text-center"><p className="text-xs text-ink-500">{m.shift} {m.start}–{m.end}</p><p className="mt-2 text-4xl font-bold tabular-nums">{now}</p>
      <button className="btn mt-3 w-full !min-h-14 text-base" onClick={() => setM({ ...m, ...(inShift ? { checkOut: now } : { checkIn: now }) })} data-testid="btn-checkin">{inShift ? "Ra ca" : "✓ Vào ca"}</button>
      <p className="mt-2 text-xs text-ink-500">{m.inSchool ? "📍 Đang ở trong trường" : "📍 Chưa ở trong trường"}</p></div>
    {m.sub && <div className="rounded-2xl border border-peach-300 bg-peach-50 p-3 text-sm"><b className="text-peach-600">↔ Trông thay hôm nay</b><p className="mt-1">Trông <b>{m.sub.className}</b> thay {m.sub.absent} ({m.sub.reason})</p></div>}
    <div className="card !p-3"><b>Tuần này</b><div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">{m.week.map((d, i) => <div key={d.date} className={`rounded-lg py-2 ${ST_UI[d.status].cls}`}>{WD[i]}<br />{d.status === "ok" ? "✓" : d.status === "none" ? "…" : ST_UI[d.status].label}</div>)}</div></div>
    <button className="min-h-12 w-full rounded-xl border border-ink-100 bg-white font-semibold">🏖 Xin nghỉ phép</button>
  </div>;
}

export default function StaffPage() {
  const role = api.me()?.role;
  if (role === "admin") return <AdminView />;
  if (role === "teacher") return <TeacherView />;
  return <p className="text-ink-500">Trang này dành cho Ban giám hiệu và giáo viên.</p>;
}
