"use client";
/** Quản lý giáo viên (mockups9): BGH xem bảng công tuần + phân trông thay; giáo viên chấm công, xin nghỉ phép. API /staff/*. */
import { useCallback, useEffect, useState } from "react";
import { api, http, todayStr } from "@/lib/api";
import { DateField } from "@/components/DateField";
import { TYPE_UI, myLeaves, Leave, leaveWhen, STATUS_UI } from "@/lib/leave-api";
import LeaveForm from "@/components/LeaveForm";
import Link from "next/link";
import { assignSubstitute, AttDay, shiftLabel, checkIn, checkOut, getMyToday, getStaffWeek, mondayOf, MyToday, ST_UI, StaffWeek, Substitution } from "@/lib/staff-api";

const errMsg = (e: unknown) => (e as { message?: string })?.message || "Có lỗi, thử lại";
const shiftWeek = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 7 * n); return x.toISOString().slice(0, 10) };

const WD = ["T2", "T3", "T4", "T5", "T6"];
const dm = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const Cell = ({ d }: { d: AttDay }) => { const u = ST_UI[d.status], t = d.leaveType ? TYPE_UI[d.leaveType] : null;
  if (t && (d.status === "leave" || d.half)) return <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs tabular-nums ${t.cls}`} title={t.label} data-testid="cell-leave">
    {d.half ? "½ " : ""}{t.icon}{d.half && d.checkIn ? ` ${d.checkIn}` : ` ${t.label}`}</span>;
  return <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-xs tabular-nums ${u.cls}`}>{d.status === "sub" ? `↔ ${d.subClass}` : d.checkIn ?? u.label}</span> };

function AdminView() {
  const [w, setW] = useState<StaffWeek | null>(null); const [wk, setWk] = useState(() => mondayOf(todayStr()));
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [pend, setPend] = useState<Leave[]>([]);
  const load = useCallback(() => { setErr(""); getStaffWeek(wk).then(setW).catch(e => setErr(errMsg(e))); myLeaves("?status=pending").then(setPend).catch(() => {}) }, [wk]);
  useEffect(load, [load]);
  const exportCsv = () => { if (!w) return;
    const head = ["Giáo viên", "Lớp", "Ca", ...w.rows[0]?.days.map(d => dm(d.date)) ?? [], "Công", "Phép"];
    const lines = [head, ...w.rows.map(r => [r.name, r.className, r.shift, ...r.days.map(d => d.status === "sub" ? `Trông thay ${d.subClass ?? ""} ${d.checkIn ?? ""}` : [d.checkIn, d.checkOut].filter(Boolean).join("-") || ST_UI[d.status].label), r.workDays, r.leaveDays])];
    const csv = "\ufeff" + lines.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `bang-cong_${w.from}_${w.to}.csv`; a.click() };
  if (err && !w) return <p className="text-rose-500" role="alert">{err}</p>;
  if (!w) return <p className="text-ink-500">Đang tải…</p>;
  const s = w.summary;
  const open = w.subs.filter(x => !x.substitute);
  const nCls = new Set(open.map(x => x.classId ?? x.className)).size, nDays = new Set(open.map(x => x.date)).size;
  const needLabel = open.length ? <>{nCls} lớp{(nDays > 1 || nCls > 1) && <span className="whitespace-nowrap text-base font-semibold"> · {nDays} ngày</span>}</> : <>{s.needSub} lớp</>;
  return <div className="mx-auto max-w-5xl space-y-4" data-testid="staff-admin">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-ink-500">Ban giám hiệu · Nhân sự</p><h1 className="text-2xl font-bold">Chấm công & ca làm <span className="block text-sm font-semibold text-ink-500 sm:inline sm:text-lg"><span className="hidden sm:inline">· </span>
        <button aria-label="Tuần trước" className="px-1" onClick={() => setWk(shiftWeek(wk, -1))}>‹</button>{dm(w.from)}–{dm(w.to)}<button aria-label="Tuần sau" className="px-1" onClick={() => setWk(shiftWeek(wk, 1))}>›</button></span></h1></div>
      <div className="flex gap-2"><button onClick={exportCsv} className="min-h-12 rounded-xl border border-ink-100 bg-white px-4 text-sm font-semibold">⬇ Xuất bảng công</button><AssignShift onDone={load} /></div></div>
    {msg && <p className="rounded-xl bg-mint-50 p-3 text-sm text-mint-700" role="status" data-testid="staff-msg">{msg}</p>}
    {err && <p className="rounded-xl bg-rose-100 p-3 text-sm text-rose-600" role="alert">{err}</p>}
    {pend.length > 0 && <div className="rounded-2xl border border-sun-500 bg-sun-100 p-3" data-testid="pending-leaves"><b>⏳ Đơn nghỉ chờ duyệt ({pend.length})</b>
      <ul className="mt-2 space-y-2">{pend.map(l => <li key={l.id}><Link href={`/staff/leaves/${l.id}`} className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white px-3 text-sm">
        <span><b>{l.userName}</b>{l.classes.length > 0 && ` · ${l.classes.map(c => c.name).join(", ")}`}<span className="block text-xs text-ink-500">{TYPE_UI[l.type]?.icon} {TYPE_UI[l.type]?.label} · {leaveWhen(l)}</span></span>
        <span className="whitespace-nowrap font-semibold text-mint-700">Xem & duyệt ›</span></Link></li>)}</ul></div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-2xl bg-mint-50 p-3"><p className="text-xs text-mint-700">Có mặt hôm nay</p><b className="text-2xl text-mint-700 tabular-nums">{s.present}/{s.total}</b></div>
      <div className="rounded-2xl bg-sun-100 p-3"><p className="text-xs">Đi muộn tuần</p><b className="text-2xl tabular-nums">{s.lateWeek}</b></div>
      <div className="rounded-2xl bg-sky-100 p-3"><p className="text-xs text-sky-500">Nghỉ phép</p><b className="text-2xl text-sky-500 tabular-nums">{s.onLeave}</b></div>
      <div className="rounded-2xl bg-peach-100 p-3"><p className="text-xs text-peach-500">Cần trông thay</p><b className="block text-2xl text-peach-500" data-testid="need-sub">{needLabel}</b></div></div>
    {w.subs.filter(x => !x.substitute).map(x => <SubAlert key={x.date + x.className + x.shiftId} x={x} onDone={(t) => { setMsg(t); load() }} onErr={setErr} />)}
    <div className="card hidden sm:block"><table className="w-full text-sm"><thead className="text-left text-xs text-ink-500"><tr><th className="py-2">Giáo viên</th>{WD.map(d => <th key={d}>{d}</th>)}<th>Công</th></tr></thead>
      <tbody className="divide-y divide-ink-100">{w.rows.map(r => <tr key={r.id} className={r.leaveDays ? "bg-peach-50" : ""}><td className="py-3"><b>{r.name}</b><br /><span className="text-xs text-ink-500">{r.className} · {r.shift}</span></td>
        {r.days.map(d => <td key={d.date}><Cell d={d} /></td>)}<td className="font-semibold">{r.workDays}{r.leaveDays > 0 && <span className="ml-1 text-xs text-sky-500">+{String(r.leaveDays).replace(".", ",")}P</span>}</td></tr>)}</tbody></table></div>
    <div className="space-y-2 sm:hidden">{w.rows.map(r => <div key={r.id} className="card !p-3"><div className="flex justify-between"><div className="min-w-0"><b className="block truncate">{r.name}</b><p className="text-xs text-ink-500">{r.className} · {r.shift}</p></div><b className="shrink-0">{r.workDays} công{r.leaveDays > 0 && <span className="text-xs text-sky-500"> +{String(r.leaveDays).replace(".", ",")}P</span>}</b></div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">{r.days.map((d, i) => <div key={d.date} className={`rounded-lg py-1.5 ${ST_UI[d.status].cls}`}>{WD[i]}<br />{d.status === "sub" ? "↔" : d.checkIn ?? ST_UI[d.status].label}</div>)}</div></div>)}</div>
  </div>;
}

function SubAlert({ x, onDone, onErr }: { x: Substitution; onDone: (msg: string) => void; onErr: (e: string) => void }) {
  const [open, setOpen] = useState(false); const [pick, setPick] = useState(x.suggestionList?.[0]?.userId ?? ""); const [busy, setBusy] = useState(false);
  const go = async () => { if (!pick) return; setBusy(true);
    try { await assignSubstitute(x, pick); onDone(`Đã phân ${x.suggestionList?.find(s => s.userId === pick)?.name ?? ""} trông ${x.className} ngày ${dm(x.date)}`); setOpen(false) } catch (e) { onErr(errMsg(e)) } finally { setBusy(false) } };
  return <div className="rounded-2xl border-2 border-peach-300 bg-peach-50 p-4 text-sm" data-testid="sub-alert">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><b className="text-peach-600">⚠ {dm(x.date)}: {x.className} thiếu giáo viên</b><p className="mt-1 text-xs text-ink-500">{x.absent} {x.reason} · {x.kids} bé · gợi ý: {x.suggestions.join(", ") || "chưa có GV rảnh"}</p></div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-12 shrink-0 rounded-xl bg-peach-500 px-4 font-semibold text-white">Phân trông thay</button></div>
    {open && <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <select aria-label="Người trông thay" value={pick} onChange={e => setPick(e.target.value)} className="input min-h-12 flex-1">
        {(x.suggestionList ?? []).map(s => <option key={s.userId} value={s.userId}>{s.name} – {s.freeNote}</option>)}
        {!x.suggestionList?.length && <option value="">Không có GV rảnh</option>}</select>
      <button disabled={!pick || busy} onClick={go} className="btn min-h-12" data-testid="sub-confirm">{busy ? "Đang lưu…" : "Xác nhận"}</button></div>}
  </div>;
}

type Opt = { id: string; name: string };
function AssignShift({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false); const [opts, setOpts] = useState<{ users: Opt[]; shifts: Opt[]; classes: Opt[] } | null>(null);
  const [f, setF] = useState({ userId: "", shiftId: "", classId: "", from: todayStr(), to: todayStr() }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open || opts) return;
    Promise.all([http.get<{ items: Opt[] } | Opt[]>("/users?role=teacher&active=true&limit=100"), http.get<{ items: Opt[] }>("/staff/shifts"), api.classes()])
      .then(([u, s, c]) => setOpts({ users: Array.isArray(u) ? u : u.items, shifts: s.items, classes: c })).catch(e => setErr(errMsg(e))) }, [open, opts]);
  const save = async () => { setBusy(true); setErr("");
    try { const r = await http.post<{ created: number }>("/staff/assignments", { userId: f.userId, shiftId: f.shiftId, classId: f.classId || undefined, from: f.from, to: f.to });
      setOpen(false); onDone(); alert(`Đã xếp ${r.created} ca`) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) } };
  return <>
    <button className="btn text-sm" onClick={() => setOpen(true)}>+ Xếp ca</button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" role="dialog" aria-label="Xếp ca" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Xếp ca (T2–T6)</h2>
        {!opts ? <p className="text-ink-500">{err || "Đang tải…"}</p> : <>
          <select aria-label="Giáo viên" className="input min-h-12 w-full" value={f.userId} onChange={e => setF({ ...f, userId: e.target.value })}><option value="">— Giáo viên —</option>{opts.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select aria-label="Ca" className="input min-h-12 w-full" value={f.shiftId} onChange={e => setF({ ...f, shiftId: e.target.value })}><option value="">— Ca —</option>{opts.shifts.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select aria-label="Lớp" className="input min-h-12 w-full" value={f.classId} onChange={e => setF({ ...f, classId: e.target.value })}><option value="">— Lớp (không bắt buộc) —</option>{opts.classes.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs text-ink-500">Từ ngày<DateField value={f.from} onChange={v => setF({ ...f, from: v })} aria-label="Từ ngày" /></label>
            <label className="text-xs text-ink-500">Đến ngày<DateField value={f.to} min={f.from} onChange={v => setF({ ...f, to: v })} aria-label="Đến ngày" /></label></div>
          {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
          <div className="flex gap-2"><button className="min-h-12 flex-1 rounded-xl border border-ink-100" onClick={() => setOpen(false)}>Huỷ</button>
            <button className="btn min-h-12 flex-1" disabled={busy || !f.userId || !f.shiftId || !f.from || !f.to} onClick={save}>Lưu</button></div></>}
      </div></div>}
  </>;
}

function TeacherView() {
  const [m, setM] = useState<MyToday | null>(null); const [now, setNow] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [leave, setLeave] = useState(false);
  const [lmsg, setLmsg] = useState(""); const [mine, setMine] = useState<Leave[]>([]);
  const punch = async (out: boolean) => { setBusy(true); setErr(""); try { setM(await (out ? checkOut() : checkIn())) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) } };
  useEffect(() => { getMyToday().then(setM).catch(e => setErr(errMsg(e))); myLeaves().then(setMine).catch(() => {}); const t = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })); t(); const id = setInterval(t, 15000); return () => clearInterval(id) }, []);
  if (!m) return err ? <p className="text-rose-500" role="alert">{err}</p> : <p className="text-ink-500">Đang tải…</p>;
  const inShift = !!m.checkIn && !m.checkOut;
  return <div className="mx-auto max-w-md space-y-3" data-testid="staff-teacher">
    <h1 className="text-2xl font-bold">Chấm công hôm nay</h1>
    <div className="card text-center"><p className="text-xs text-ink-500">{shiftLabel(m.shift)}{m.start && ` ${m.start}–${m.end}`}</p><p className="mt-2 text-4xl font-bold tabular-nums">{now}</p>
      {m.checkOut ? <p className="mt-3 rounded-xl bg-mint-50 p-3 text-sm text-mint-700">✓ Đã ra ca lúc {m.checkOut}</p>
        : <button className="btn mt-3 w-full !min-h-14 text-base" disabled={busy} onClick={() => punch(inShift)} data-testid="btn-checkin">{inShift ? "Ra ca" : "✓ Vào ca"}</button>}
      <p className="mt-2 text-xs text-ink-500">{m.checkIn ? `Vào ca lúc ${m.checkIn}` : "Chưa vào ca"}{m.inSchool ? " · 📍 Đang ở trong trường" : ""}</p>
      {err && <p className="mt-2 text-sm text-rose-500" role="alert">{err}</p>}</div>
    {m.sub && <div className="rounded-2xl border border-peach-300 bg-peach-50 p-3 text-sm"><b className="text-peach-600">↔ Trông thay hôm nay</b><p className="mt-1">Trông <b>{m.sub.className}</b> thay {m.sub.absent} ({m.sub.reason})</p></div>}
    <div className="card !p-3"><b>Tuần này</b><div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">{m.week.map((d, i) => <div key={d.date} className={`rounded-lg py-2 ${ST_UI[d.status].cls}`}>{WD[i]}<br />{d.status === "ok" ? "✓" : d.status === "none" ? "…" : ST_UI[d.status].label}</div>)}</div></div>
    {lmsg && <p className="rounded-xl bg-mint-50 p-3 text-sm text-mint-700" role="status">{lmsg}</p>}
    {leave ? <LeaveForm onCancel={() => setLeave(false)} onDone={() => { setLeave(false); setLmsg("Đã gửi đơn, Ban giám hiệu sẽ được báo"); myLeaves().then(setMine).catch(() => {}) }} />
      : <button onClick={() => { setLeave(true); setLmsg("") }} className="min-h-12 w-full rounded-xl border border-ink-100 bg-white font-semibold" data-testid="btn-leave">🏖 Xin nghỉ</button>}
    {mine.length > 0 && <div className="card !p-3" data-testid="my-leaves"><b>Đơn nghỉ của tôi</b><ul className="mt-2 space-y-2">{mine.slice(0, 5).map(l => <li key={l.id}>
      <Link href={`/staff/leaves/${l.id}`} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-sm ${STATUS_UI[l.status].cls}`}>
        <span>{TYPE_UI[l.type]?.icon} {leaveWhen(l)}</span><span className="whitespace-nowrap font-semibold">{STATUS_UI[l.status].short} ›</span></Link></li>)}</ul></div>}
  </div>;
}

export default function StaffPage() {
  const role = api.me()?.role;
  if (role === "admin") return <AdminView />;
  if (role === "teacher") return <TeacherView />;
  return <p className="text-ink-500">Trang này dành cho Ban giám hiệu và giáo viên.</p>;
}
