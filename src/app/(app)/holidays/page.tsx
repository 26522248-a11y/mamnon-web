"use client";
/**
 * Admin: Lịch nghỉ (round2 §2 + 228bba9 addendum). Confirmed day = peach-100/peach-600 + name; pending (Tết, Giỗ Tổ…) = sun-100 + dashed sun-500
 * + "Chờ xác nhận" and NO effect until confirmed. Yellow banner when any pending → "Xem & xác nhận" filters + scrolls to the pending list.
 */
import { DateField } from "@/components/DateField"; import { fmtDate, fmtDateTime } from "@/lib/date"; import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { EmergencyDialog } from "./EmergencyDialog"; import { confirmHoliday, confirmHolidayYear, createHoliday, deleteHoliday, Holiday, holidayTemplateApply, holidayTemplatePreview, HolidayTemplate, listHolidays, msgErrorText, msgFeatures, vnToday } from "@/lib/messages-api";

const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const vnD = (d: string) => fmtDate(d);
const pad = (n: number) => String(n).padStart(2, "0");
const at = (iso: string) => fmtDateTime(iso);
const confirmedText = (h: Holiday) => h.status === "confirmed" && (h.confirmedBy?.name ?? h.confirmedByName) ? `Xác nhận bởi ${h.confirmedBy?.name ?? h.confirmedByName}${h.confirmedAt ? ` lúc ${at(h.confirmedAt)}` : ""}` : "";

export default function HolidaysPage() {
  const me = api.me()!; const today = vnToday();
  const [ok, setOk] = useState<boolean | null>(null); const [year, setYear] = useState(Number(today.slice(0, 4))); const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [items, setItems] = useState<Holiday[]>([]); const [onlyPending, setOnlyPending] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [tpl, setTpl] = useState<HolidayTemplate | null>(null); const [em, setEm] = useState(false); const listRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState({ date: "", to: "", name: "", kind: "school" as "school" | "national" });
  useEffect(() => { msgFeatures().then(f => setOk(f.holidays)) }, []);
  const load = useCallback(() => { listHolidays({ year }).then(setItems).catch(e => setErr(msgErrorText(e))) }, [year]);
  useEffect(() => { if (ok) load() }, [ok, load]);
  if (me.role !== "admin") return <p className="text-ink-500">Chỉ Ban giám hiệu quản lý lịch nghỉ.</p>;
  if (ok === null) return <p>Đang tải…</p>;
  if (!ok) return <div className="card mx-auto max-w-md space-y-2 text-center" data-testid="holidays-soon"><div className="text-3xl">🚧</div><b>Lịch nghỉ: sắp có</b><p className="text-sm text-ink-500">Tính năng đang được hoàn thiện.</p></div>;

  const pending = items.filter(h => h.status === "pending");
  const act = async (key: string, f: () => Promise<unknown>, done: string) => { setBusy(key); setErr(""); setMsg("");
    try { await f(); setMsg(done); load() } catch (e) { setErr(msgErrorText(e)) } finally { setBusy("") } };
  const showPending = () => { setOnlyPending(true); setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50) };
  // month grid (Mon-first)
  const first = new Date(Date.UTC(year, month - 1, 1)); const lead = (first.getUTCDay() + 6) % 7; const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)];
  const byDate = new Map(items.map(h => [h.date, h]));
  const shown = (onlyPending ? pending : items).slice().sort((a, b) => a.date.localeCompare(b.date));
  const step = (n: number) => { let m = month + n, y = year; if (m < 1) { m = 12; y-- } if (m > 12) { m = 1; y++ } setMonth(m); if (y !== year) setYear(y) };

  return <div className="mx-auto max-w-3xl space-y-4" data-testid="holidays-page">
    {em && <EmergencyDialog date={today} onClose={() => setEm(false)} onDone={m => { setEm(false); setMsg(m); load() }} />}
    <h1 className="text-2xl font-bold">Lịch nghỉ</h1>
    {pending.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sun-100 p-4" data-testid="holidays-pending-banner">
      <span>⏳ Còn <b>{pending.length}</b> ngày lễ chờ Ban giám hiệu xác nhận</span>
      <div className="flex flex-wrap gap-2"><button className="min-h-12 rounded-xl bg-sun-500 px-4 font-semibold text-ink-900" onClick={showPending} data-testid="holidays-see-pending">Xem &amp; xác nhận</button>
        <button className="min-h-12 rounded-xl bg-white px-4 font-semibold text-ink-900" disabled={!!busy} data-testid="holidays-confirm-year"
          onClick={() => confirm(`Xác nhận cả ${pending.length} ngày lễ còn chờ của năm ${year}? Các ngày này sẽ thành ngày trường nghỉ.`) && act("year", () => confirmHolidayYear(year), `Đã xác nhận các ngày lễ năm ${year}.`)}>Xác nhận cả năm</button></div></div>}
    {msg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700">{msg}</p>}
    {err && <p className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-500">{err}</p>}

    <section className="card space-y-3" data-testid="holidays-calendar">
      <div className="flex items-center justify-between"><button className="min-h-12 min-w-12 rounded-xl bg-ink-100" onClick={() => step(-1)} aria-label="Tháng trước">‹</button>
        <b>Tháng {month}/{year}</b><button className="min-h-12 min-w-12 rounded-xl bg-ink-100" onClick={() => step(1)} aria-label="Tháng sau">›</button></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">{DOW.map(d => <div key={d} className="py-1 font-semibold text-ink-500">{d}</div>)}
        {cells.map((d, i) => { if (!d) return <div key={"e" + i} />; const h = byDate.get(d); const wk = i % 7 >= 5;
          const emg = h?.kind === "emergency" && h.status === "confirmed";
          const cls = !h ? (wk ? "text-ink-300" : "bg-white") : emg ? "bg-rose-100 text-rose-500" : h.status === "pending" ? "border-2 border-dashed border-sun-500 bg-sun-100 text-ink-700" : "bg-peach-100 text-peach-600";
          return <div key={d} data-testid="holiday-day" data-status={h?.status ?? ""} title={h ? [h.name, confirmedText(h)].filter(Boolean).join(" · ") : undefined}
            className={`flex min-h-14 flex-col items-center justify-start rounded-xl p-1 ${cls} ${d === today ? "ring-2 ring-mint-500" : ""}`}>
            <span className="font-semibold">{Number(d.slice(8))}</span>
            {h && <span className="line-clamp-2 text-[10px] leading-tight">{emg ? `⚠ ${h.name}` : h.status === "pending" ? "Chờ xác nhận" : h.name}</span>}
            {d === today && !h && !wk && <button onClick={() => setEm(true)} data-testid="emergency-open"
              className="mt-0.5 w-full flex-1 rounded-lg border-2 border-rose-500 bg-white px-0.5 text-[9px] font-semibold leading-tight text-rose-500">Đóng cửa đột xuất</button>}</div> })}</div>
      <div className="flex flex-wrap gap-3 text-xs"><span className="rounded-full bg-peach-100 px-2 py-1 text-peach-600">Trường nghỉ</span>
        <span className="rounded-full border border-dashed border-sun-500 bg-sun-100 px-2 py-1">Chờ xác nhận (chưa có hiệu lực)</span>
        <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-500">⚠ Nghỉ đột xuất</span></div></section>

    <section ref={listRef} className="card space-y-2" data-testid="holidays-list">
      <div className="flex flex-wrap items-center justify-between gap-2"><b>Năm {year} · {items.length} ngày</b>
        <div className="flex gap-1">{([[false, "Tất cả"], [true, `Chờ xác nhận (${pending.length})`]] as [boolean, string][]).map(([v, l]) =>
          <button key={l} onClick={() => setOnlyPending(v)} className={`min-h-12 rounded-xl px-3 text-sm ${onlyPending === v ? "bg-ink-900 text-white" : "bg-ink-100"}`}>{l}</button>)}</div></div>
      {!shown.length && <p className="text-sm text-ink-500">{onlyPending ? "Không còn ngày nào chờ xác nhận." : "Chưa có ngày nghỉ nào."}</p>}
      {shown.map(h => <div key={h.id} data-testid="holiday-row" data-status={h.status}
        className={`flex min-h-12 flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${h.kind === "emergency" ? "bg-rose-100" : h.status === "pending" ? "border-2 border-dashed border-sun-500 bg-sun-100" : "bg-peach-100"}`}>
        <span className="w-24 font-semibold">{vnD(h.date)}</span>
        <span className={`flex-1 ${h.kind === "emergency" ? "text-rose-500" : h.status === "pending" ? "text-ink-700" : "text-peach-600"}`}>{h.kind === "emergency" ? "⚠ " : ""}{h.name} <span className="text-xs text-ink-500">· {h.kind === "national" ? "Lễ quốc gia" : h.kind === "emergency" ? "Đột xuất" : "Trường"}</span>
          {h.reason && <span className="block text-xs" data-testid="holiday-reason">Lý do: {h.reason}</span>}
          {h.status === "pending" && <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs">Chờ xác nhận</span>}
          {confirmedText(h) && <span className="block text-xs text-ink-500" data-testid="holiday-confirmed-by">{confirmedText(h)}</span>}</span>
        {h.status === "pending" && <button className="min-h-12 rounded-xl bg-mint-500 px-4 text-sm font-semibold text-white" disabled={!!busy} data-testid="holiday-confirm"
          onClick={() => act(h.id, () => confirmHoliday(h.id), `Đã xác nhận nghỉ ${vnD(h.date)} – ${h.name}.`)}>Xác nhận</button>}
        <button className="min-h-12 px-2 text-sm text-rose-500 underline" disabled={!!busy} data-testid="holiday-delete"
          onClick={() => confirm(`Xoá ngày nghỉ ${vnD(h.date)} – ${h.name}?`) && act(h.id, () => deleteHoliday(h.id), "Đã xoá.")}>Xoá</button></div>)}</section>

    <section className="card space-y-2" data-testid="holiday-add"><b>Thêm ngày nghỉ</b>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Từ ngày<DateField value={form.date} onChange={v => setForm({ ...form, date: v, to: form.to && form.to < v ? v : form.to })} /></label>
        <label className="text-sm">Đến ngày (nếu nghỉ nhiều ngày)<DateField min={form.date || undefined} value={form.to} onChange={v => setForm({ ...form, to: v })} /></label></div>
      <input className="input" placeholder="Tên (vd Nghỉ hè, Tổng vệ sinh trường)" maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <div className="flex gap-2">{([["school", "Trường"], ["national", "Lễ quốc gia"]] as const).map(([v, l]) => <button key={v} onClick={() => setForm({ ...form, kind: v })}
        className={`min-h-12 rounded-xl px-4 text-sm ${form.kind === v ? "bg-mint-500 text-white" : "bg-ink-100"}`}>{l}</button>)}</div>
      <button className="btn w-full" disabled={!form.date || !form.name.trim() || !!busy} data-testid="holiday-add-save"
        onClick={() => act("add", () => createHoliday({ date: form.date, to: form.to && form.to !== form.date ? form.to : undefined, name: form.name.trim(), kind: form.kind }),
          "Đã thêm ngày nghỉ.").then(() => setForm({ date: "", to: "", name: "", kind: "school" }))}>Thêm</button></section>

    <section className="card space-y-2" data-testid="holiday-template"><b>Ngày lễ quốc gia năm {year}</b>
      {!tpl ? <button className="min-h-12 w-full rounded-xl bg-ink-100" disabled={!!busy} onClick={() => holidayTemplatePreview(year).then(setTpl).catch(e => setErr(msgErrorText(e)))}>Xem danh sách mẫu</button> : <>
        <div className="space-y-1">{tpl.items.map(x => <div key={x.date} className="flex justify-between text-sm"><span>{vnD(x.date)} · {x.name}{x.status === "pending" && <span className="ml-1 rounded-full bg-sun-100 px-2 text-xs">sẽ chờ xác nhận</span>}</span><span className="text-ink-500">{x.exists ? "Đã có" : "Chưa có"}</span></div>)}</div>
        <p className="text-xs text-ink-500">Ngày âm lịch (Tết, Giỗ Tổ) được thêm ở trạng thái chờ xác nhận — kiểm tra lại rồi bấm Xác nhận.</p>
        <div className="flex gap-2"><button className="min-h-12 flex-1 rounded-xl bg-ink-100" onClick={() => setTpl(null)}>Đóng</button>
          <button className="btn flex-1" disabled={!!busy || !tpl.items.some(x => !x.exists)} data-testid="holiday-template-apply"
            onClick={() => act("tpl", () => holidayTemplateApply(year), "Đã thêm các ngày lễ còn thiếu.").then(() => setTpl(null))}>Thêm {tpl.items.filter(x => !x.exists).length} ngày còn thiếu</button></div></>}</section>
  </div>;
}
