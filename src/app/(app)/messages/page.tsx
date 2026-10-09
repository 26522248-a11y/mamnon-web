"use client";
/** Parent: "Nhắn cô về bé" — báo nghỉ (one-tap Hôm nay), dặn thuốc (ảnh + liều + giờ), xin đón muộn; plus what was sent today. */
import { DateField } from "@/components/DateField"; import { TimeField } from "@/components/TimeField"; import { fmtDate, fmtDateTime } from "@/lib/date"; import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api"; import { Child } from "@/lib/types";
import { ABSENCE_REASONS, Absence, absenceHistory, AbsenceReason, addDays, cancelAbsence, cancelLatePickup, cancelMedicine, createMedicine, DOSE_PRESETS, getMsgConfig, Holiday, isConfirmedHoliday, LatePickup,
  listAbsences, listHolidays, listMedicinesRange, listLatePickups, listMedicines, Medicine, msgErrorText, MsgConfig, MsgFeatures, msgFeatures, refundPreview, reportAbsence, requestLatePickup, vnNowHHMM, vnToday } from "@/lib/messages-api";
import { isAllowedPhoto, isHeic, PHOTO_ACCEPT, PHOTO_MAX_BYTES, shrinkImage } from "@/lib/pickup-api";
import { hhmm, PersonPhoto, PreviewImg } from "@/components/pickup-safety"; import { AutoTextarea } from "@/components/AutoTextarea";

type Tab = "absence" | "medicine" | "late";
const TABS: [Tab, string, string][] = [["absence", "🛌", "Báo nghỉ"], ["medicine", "💊", "Dặn thuốc"], ["late", "⏰", "Đón muộn"]];
const vnD = (d: string) => fmtDate(d);

export default function Messages() {
  const me = api.me()!; const [kids, setKids] = useState<Child[]>([]); const [i, setI] = useState(0); const [tab, setTab] = useState<Tab>("absence");
  const [cfg, setCfg] = useState<MsgConfig | null>(null); const [ft, setFt] = useState<MsgFeatures | null>(null); const [msg, setMsg] = useState("");
  const [hol, setHol] = useState<Holiday[]>([]);
  const [abs, setAbs] = useState<Absence[]>([]); const [hist, setHist] = useState<Absence[]>([]); const [meds, setMeds] = useState<Medicine[]>([]); const [lates, setLates] = useState<LatePickup[]>([]);
  const [pastMeds, setPastMeds] = useState<Medicine[]>([]); const [pastLates, setPastLates] = useState<LatePickup[]>([]);
  useEffect(() => { api.children({ limit: 20 }).then(r => setKids(r.items)).catch(() => {}); getMsgConfig().then(setCfg); msgFeatures().then(setFt) }, []);
  const k = kids[i]; const today = vnToday();
  // only CONFIRMED holidays block reporting; pending (Tết/Giỗ Tổ chưa xác nhận) have no effect
  useEffect(() => { if (ft?.holidays) listHolidays({ from: addDays(today, -31), to: addDays(today, 60) }).then(h => setHol(h.filter(isConfirmedHoliday))).catch(() => {}) }, [ft, today]);
  const load = useCallback(() => { if (!k || !ft) return;
    if (ft.absences) { listAbsences(k.id, today).then(setAbs).catch(() => setAbs([]));
      absenceHistory(k.id, addDays(today, -30), addDays(today, -1)).then(setHist).catch(() => setHist([])) }
    if (ft.medicines) { listMedicines(k.id, today).then(setMeds).catch(() => setMeds([]));
      listMedicinesRange(k.id, addDays(today, -30), addDays(today, -1)).then(setPastMeds).catch(() => setPastMeds([])) }
    if (ft.latePickups) { listLatePickups(k.id, today).then(setLates).catch(() => setLates([]));
      listLatePickups(k.id, addDays(today, -30), addDays(today, -1)).then(setPastLates).catch(() => setPastLates([])) } }, [k, today, ft]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load]);
  if (me.role !== "parent") return <p className="text-ink-500">Trang này dành cho phụ huynh.</p>;
  if (!k || !cfg || !ft) return <p>Đang tải…</p>;
  const on: Record<Tab, boolean> = { absence: ft.absences, medicine: ft.medicines, late: ft.latePickups };
  const done = (m: string) => { setMsg(m); load() };
  return <div className="mx-auto max-w-md space-y-4" data-testid="messages-page">
    <div><div className="text-sm text-ink-500">Phụ huynh · Gửi lời nhắn</div><h1 className="text-2xl font-bold">Nhắn cô về bé {k.fullName.split(" ").pop()}</h1></div>
    {kids.length > 1 && <div className="flex gap-2">{kids.map((x, j) => <button key={x.id} onClick={() => { setI(j); setMsg("") }} className={`min-h-12 rounded-xl px-4 ${j === i ? "bg-mint-500 text-white" : "bg-white"}`}>{x.fullName.split(" ").pop()}</button>)}</div>}
    <div className="grid grid-cols-3 gap-2">{TABS.map(([t, ic, l]) => <button key={t} onClick={() => { setTab(t); setMsg("") }} data-testid={`msg-tab-${t}`}
      className={`flex min-h-20 flex-col items-center justify-center rounded-2xl text-sm ${tab === t ? "border-2 border-rose-500 bg-rose-100 font-semibold" : "bg-white"}`}><span className="text-2xl">{ic}</span>{l}{!on[t] && <span className="text-[10px] text-ink-500">Sắp có</span>}</button>)}</div>
    {!on[tab] ? <Soon what={TABS.find(t => t[0] === tab)![2]} /> : <>
      {tab === "absence" && <AbsenceForm child={k} cfg={cfg} holidays={hol} onDone={done} />}
      {tab === "medicine" && <MedicineForm child={k} onDone={done} />}
      {tab === "late" && <LateForm child={k} cfg={cfg} holiday={hol.find(h => h.date === today)} onDone={done} />}</>}
    {msg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="messages-msg">{msg}</p>}
    <Sent abs={abs} meds={meds} lates={lates} onChange={load} />
    {tab === "medicine" && ft.medicines && <PastList title="medicine" empty="Chưa có lần dặn thuốc nào" rows={pastMeds.filter(m => m.status !== "cancelled").sort((a, b) => b.date.localeCompare(a.date)).map(m =>
      ({ key: m.id, date: m.date, text: `💊 ${m.name} · ${m.dose}`, sub: `${m.doses.filter(d => d.givenAt).length}/${m.doses.length} liều đã cho uống` }))} />}
    {tab === "late" && ft.latePickups && <PastList title="late" empty="Chưa có lần đón muộn nào" rows={pastLates.filter(l => l.status !== "cancelled").sort((a, b) => b.date.localeCompare(a.date)).map(l =>
      ({ key: l.id, date: l.date, text: `⏰ Đón lúc ${l.time}${l.pickerName ? ` · ${l.pickerName}` : ""}`, sub: l.note ?? "" }))} />}
    {tab === "absence" && ft.absences && <AbsenceHistory items={hist} holidays={hol} cutoff={cfg.absenceCutoff} from={addDays(today, -30)} to={addDays(today, -1)} />}
  </div>;
}

const weekend = (d: string) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay());
function AbsenceForm({ child, cfg, holidays, onDone }: { child: Child; cfg: MsgConfig; holidays: Holiday[]; onDone: (m: string) => void }) {
  const today = vnToday(); const [mode, setMode] = useState<"today" | "tomorrow" | "range">("today");
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today); const [reason, setReason] = useState<AbsenceReason>("sick"); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [now, setNow] = useState(vnNowHHMM());
  useEffect(() => { const t = setInterval(() => setNow(vnNowHHMM()), 15000); return () => clearInterval(t) }, []);
  const range = mode === "today" ? [today, today] : mode === "tomorrow" ? [addDays(today, 1), addDays(today, 1)] : [from, to];
  const lateToday = range[0] === today && !refundPreview(today, cfg.absenceCutoff, now, today);
  const days: string[] = []; for (let d = range[0]; d <= range[1] && days.length < 62; d = addDays(d, 1)) days.push(d);
  const holIn = holidays.filter(h => days.includes(h.date)); const schoolDays = days.filter(d => !weekend(d) && !holIn.some(h => h.date === d));
  const send = async () => { setErr("");
    if (range[0] < today) return setErr("Không báo nghỉ cho ngày đã qua"); if (range[1] < range[0]) return setErr("Ngày kết thúc phải sau ngày bắt đầu");
    if (reason === "other" && !note.trim()) return setErr("Ghi rõ lý do nghỉ");
    if (!schoolDays.length) return setErr(holIn.length ? `Trường nghỉ ${holIn.map(h => h.name).join(", ")}, không cần báo nghỉ` : "Các ngày đã chọn là cuối tuần, không cần báo nghỉ");
    setBusy(true);
    try { const a = await reportAbsence(child.id, { from: range[0], to: range[1], reason, note: note.trim() || undefined });
      const refund = a.days?.filter(d => d.refundEligible).length;
      const sk = a.skippedDates?.length ? ` Không tính ${a.skippedDates.length} ngày nghỉ/cuối tuần.` : "";
      onDone(`Đã báo cô: bé nghỉ ${range[0] === range[1] ? vnD(range[0]) : `${vnD(range[0])}–${vnD(range[1])}`} (Vắng có phép)${refund != null ? ` · ${refund} ngày được hoàn tiền ăn` : ""}.${sk}`); setNote("") }
    catch (e) { setErr(msgErrorText(e)) } finally { setBusy(false) } };
  return <div className="card space-y-3" data-testid="absence-form"><b>Nghỉ ngày nào?</b>
    <div className="grid grid-cols-2 gap-2">
      <button className={`min-h-12 rounded-xl ${mode === "today" ? "bg-mint-500 font-semibold text-white" : "bg-ink-100"}`} onClick={() => setMode("today")} data-testid="absence-today">Hôm nay</button>
      <button className={`min-h-12 rounded-xl ${mode === "tomorrow" ? "bg-mint-500 font-semibold text-white" : "bg-ink-100"}`} onClick={() => setMode("tomorrow")} data-testid="absence-tomorrow">Ngày mai</button></div>
    <button className={`min-h-12 w-full rounded-xl text-left px-4 ${mode === "range" ? "bg-mint-100 ring-2 ring-mint-500" : "bg-ink-100"}`} onClick={() => setMode("range")} data-testid="absence-range">📅 Chọn nhiều ngày…</button>
    {mode === "range" && <div className="grid grid-cols-2 gap-2 text-sm"><label>Từ<DateField min={today} value={from} onChange={v => { if (!v) return; setFrom(v); if (to < v) setTo(v) }} data-testid="absence-from" /></label>
      <label>Đến<DateField min={from} value={to} onChange={v => { if (v) setTo(v) }} data-testid="absence-to" /></label></div>}
    <b>Lý do</b>
    <div className="flex flex-wrap gap-2">{ABSENCE_REASONS.map(([v, l]) => <button key={v} onClick={() => setReason(v)} data-testid={`absence-reason-${v}`} className={`min-h-12 rounded-full px-4 text-sm ${reason === v ? "bg-mint-500 font-semibold text-white" : "bg-ink-100"}`}>{l}</button>)}</div>
    <AutoTextarea placeholder="Ví dụ: Bé sốt nhẹ từ tối qua…" value={note} maxLength={500} onChange={e => setNote(e.target.value)} data-testid="absence-note" />
    {!lateToday && <p className="text-xs text-mint-700" data-testid="absence-rule">✓ Báo trước {cfg.absenceCutoff} sẽ được hoàn tiền ăn. Sau {cfg.absenceCutoff} vẫn là “Vắng có phép” nhưng không hoàn tiền ăn ngày đó.</p>}
    {holIn.length > 0 && <p className="rounded-xl bg-peach-100 p-2 text-xs text-peach-600" data-testid="absence-holiday">🏖️ Trường nghỉ: {holIn.map(h => `${vnD(h.date)} ${h.name}`).join(", ")} (không cần báo).</p>}
    {lateToday && <p className="rounded-xl bg-sun-100 p-2 text-xs" data-testid="absence-late">Đã quá {cfg.absenceCutoff}: hôm nay không được hoàn tiền ăn{range[1] > range[0] ? ", các ngày sau vẫn được hoàn" : ""}.</p>}
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <button className="btn min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100 text-lg" disabled={busy} onClick={send} data-testid="absence-send">{busy ? "Đang gửi…" : "Gửi cho cô"}</button></div>;
}

function MedicineForm({ child, onDone }: { child: Child; onDone: (m: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null); const [times, setTimes] = useState<{ time: string; label: string }[]>([]); const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const toggle = (t: string, l: string) => setTimes(x => x.some(y => y.time === t) ? x.filter(y => y.time !== t) : [...x, { time: t, label: l }].sort((a, b) => a.time.localeCompare(b.time)));
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setErr(""); const f = new FormData(e.currentTarget);
    if (!String(f.get("name") ?? "").trim()) return setErr("Nhập tên thuốc"); if (!String(f.get("dose") ?? "").trim()) return setErr("Nhập liều (vd 5 ml)");
    if (!times.length) return setErr("Chọn ít nhất một giờ uống");
    const raw = f.get("photo") as File | null;
    if (raw && raw.size) { if (!isAllowedPhoto(raw)) return setErr("Ảnh phải là JPG, PNG hoặc HEIC"); const ph = await shrinkImage(raw); if (ph.size > PHOTO_MAX_BYTES && !isHeic(ph)) return setErr("Ảnh tối đa 3MB"); f.set("photo", ph) } else f.delete("photo");
    if (!String(f.get("note") ?? "").trim()) f.delete("note");
    f.set("date", vnToday()); f.set("doses", JSON.stringify(times));
    setBusy(true); try { const m = await createMedicine(child.id, f); onDone(`Đã dặn cô cho bé uống ${m.name} ${m.dose} lúc ${times.map(t => t.time).join(", ")}.`); setTimes([]); setPreview(null); (e.target as HTMLFormElement).reset() }
    catch (x) { setErr(msgErrorText(x)) } finally { setBusy(false) } }
  return <form onSubmit={submit} className="card space-y-3" data-testid="medicine-form"><b>💊 Thuốc cho bé hôm nay</b>
    <label className="flex min-h-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-mint-50 text-mint-700">
      {preview ? <PreviewImg src={preview} /> : "📷 Chụp ảnh thuốc / đơn thuốc"}
      <input type="file" name="photo" accept={PHOTO_ACCEPT} capture="environment" className="sr-only" data-testid="medicine-photo" onChange={e => { const x = e.target.files?.[0]; setPreview(x ? URL.createObjectURL(x) : null) }} /></label>
    <input name="name" className="input" placeholder="Tên thuốc (vd Siro ho Prospan)" maxLength={120} required data-testid="medicine-name" />
    <input name="dose" className="input" placeholder="Liều mỗi lần (vd 5 ml, 1 gói)" maxLength={60} required data-testid="medicine-dose" />
    <div><div className="mb-1 text-sm">Giờ uống</div><div className="flex flex-wrap gap-2">{DOSE_PRESETS.map(([t, l]) => <button type="button" key={t} onClick={() => toggle(t, l)} data-testid={`medicine-time-${t}`}
      className={`min-h-12 rounded-xl px-3 text-sm ${times.some(x => x.time === t) ? "bg-mint-500 text-white" : "bg-ink-100"}`}>{l} · {t}</button>)}</div>
      <div className="mt-2 flex gap-2"><TimeField className="flex-1" value={custom} onChange={setCustom} data-testid="medicine-time-custom" aria-label="Giờ uống khác" />
        <button type="button" className="min-h-12 shrink-0 rounded-xl bg-ink-100 px-3 text-sm" onClick={() => { if (custom && !times.some(x => x.time === custom)) toggle(custom, ""); setCustom("") }}>+ Thêm giờ</button></div>
      {times.length > 0 && <p className="mt-1 text-sm" data-testid="medicine-times">Uống {times.length} lần: {times.map(t => t.time).join(", ")}</p>}</div>
    <AutoTextarea name="note" placeholder="Dặn thêm (vd lắc đều trước khi uống)" maxLength={500} />
    <p className="rounded-xl bg-sun-100 p-2 text-xs">Cô chỉ cho uống đúng theo lời dặn này. Liều khác cần phụ huynh gọi xác nhận.</p>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <button className="btn min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100 text-lg" disabled={busy} data-testid="medicine-send">{busy ? "Đang gửi…" : "Gửi cho cô"}</button></form>;
}

function LateForm({ child, cfg, holiday, onDone }: { child: Child; cfg: MsgConfig; holiday?: Holiday; onDone: (m: string) => void }) {
  const [time, setTime] = useState("17:30"); const [who, setWho] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const tooLate = time > cfg.latestPickup; const tooEarly = !!time && time < cfg.schoolOpenTime;
  if (holiday) return <p className="card bg-peach-100 text-peach-600" data-testid="late-holiday">🏖️ Hôm nay trường nghỉ ({holiday.name}).</p>;
  const send = async () => { setErr(""); if (!time) return setErr("Chọn giờ đón");
    setBusy(true); try { await requestLatePickup(child.id, { date: vnToday(), time, pickerName: who.trim() || undefined, note: note.trim() || undefined }); onDone(`Đã báo cô: đón bé muộn lúc ${time}${who.trim() ? ` (${who.trim()})` : ""}.`) }
    catch (e) { setErr(msgErrorText(e)) } finally { setBusy(false) } };
  return <div className="card space-y-3" data-testid="late-form"><b>⏰ Đón bé muộn hôm nay</b>
    <label className="block text-sm">Giờ đón<TimeField value={time} onChange={setTime} data-testid="late-time" aria-label="Giờ đón" /></label>
    {tooLate && <p className="rounded-xl bg-sun-100 p-2 text-xs" data-testid="late-warning">Trường trông trẻ đến {cfg.latestPickup}. Đón sau giờ này cần gọi trước cho cô.</p>}
    {tooEarly && <p className="rounded-xl bg-sun-100 p-2 text-xs">Trường mở cửa từ {cfg.schoolOpenTime}.</p>}
    <input className="input" placeholder="Ai đón? (để trống nếu bố mẹ đón)" value={who} onChange={e => setWho(e.target.value)} maxLength={120} data-testid="late-who" />
    <p className="text-xs text-ink-500">Người đón vẫn phải có trong danh sách đón bé (hoặc đã được trường duyệt).</p>
    <AutoTextarea placeholder="Ghi chú cho cô" value={note} maxLength={500} onChange={e => setNote(e.target.value)} />
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <button className="btn min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100 text-lg" disabled={busy} onClick={send} data-testid="late-send">{busy ? "Đang gửi…" : "Gửi cho cô"}</button></div>;
}

function Sent({ abs, meds, lates, onChange }: { abs: Absence[]; meds: Medicine[]; lates: LatePickup[]; onChange: () => void }) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const run = async (key: string, ask: string, f: () => Promise<unknown>) => { if (!confirm(ask)) return; setBusy(key); setErr("");
    try { await f(); onChange() } catch (e) { setErr(msgErrorText(e)) } finally { setBusy("") } };
  const liveMeds = meds.filter(m => m.status !== "cancelled"); const liveLates = lates.filter(l => l.status !== "cancelled"); const liveAbs = abs.filter(a => a.status !== "cancelled");
  if (!liveAbs.length && !liveMeds.length && !liveLates.length) return null;
  return <section className="space-y-2" data-testid="messages-sent"><h2 className="font-semibold">Đã nhắn cô</h2>
    {err && <p className="rounded-xl bg-rose-100 p-2 text-sm text-rose-500" data-testid="sent-error">{err}</p>}
    {liveMeds.map(m => { const given = m.doses.some(d => d.givenAt); return <div key={m.id} className="card space-y-2" data-testid="sent-medicine"><div className="flex gap-3">{m.photoUrl && <PersonPhoto url={m.photoUrl} alt={m.name} className="h-16 w-16 shrink-0" />}
      <div className="flex-1"><b>💊 {m.name}</b> · {m.dose}{m.note && <div className="text-sm text-ink-500">{m.note}</div>}</div>
      {!given && <button className="min-h-12 shrink-0 px-2 text-sm text-rose-500 underline" disabled={!!busy} data-testid="sent-medicine-cancel"
        onClick={() => run(m.id, `Hủy dặn thuốc ${m.name}?`, () => cancelMedicine(m.id))}>Hủy</button>}</div>
      {m.doses.map(d => <div key={d.id} data-testid="sent-dose" data-given={!!d.givenAt} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 ${d.givenAt ? "bg-mint-100" : d.late ? "bg-sun-100" : "bg-ink-100"}`}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${d.givenAt ? "bg-mint-500 text-white" : "bg-white"}`}>{d.givenAt ? "✓" : "⏳"}</span>
        <span className="text-sm">{d.label ? `${d.label} · ` : ""}{d.time}{d.givenAt ? <> — <b>Đã cho uống</b> · {d.givenByName ?? "Cô"} · {hhmm(d.givenAt)}{d.givenNote ? ` · “${d.givenNote}”` : ""}</> : " — chưa uống"}</span></div>)}</div> })}
    {liveAbs.map(a => <div key={a.id} className="card space-y-2 bg-sky-100" data-testid="sent-absence"><div className="text-sm">🛌 Nghỉ {a.from === a.to ? vnD(a.from) : `${vnD(a.from)}–${vnD(a.to)}`} · Vắng có phép
      {a.days?.some(d => d.refundEligible && !d.cancelled) && <span className="block text-xs text-mint-700">Hoàn tiền ăn: {a.days.filter(d => d.refundEligible && !d.cancelled).map(d => vnD(d.date)).join(", ")}</span>}
      {a.days?.some(d => d.overridden) && <span className="block text-xs text-ink-500">Cô đã điểm “Có mặt” ngày {a.days.filter(d => d.overridden).map(d => vnD(d.date)).join(", ")} (không hoàn tiền ăn)</span>}</div>
      <div className="flex flex-wrap gap-2">{(a.days ?? []).map(d => { const can = a.cancellable?.includes(d.date);
        return d.cancelled ? <span key={d.date} className="rounded-full bg-white px-3 py-1 text-xs text-ink-500 line-through">{vnD(d.date)}</span>
          : <button key={d.date} disabled={!can || !!busy} data-testid="sent-absence-day" title={can ? "Hủy ngày này" : "Đã quá giờ hủy"}
            onClick={() => run(a.id + d.date, `Hủy báo nghỉ ngày ${vnD(d.date)}? Bé sẽ đi học ngày này.`, () => cancelAbsence(a.id, [d.date]))}
            className={`min-h-12 rounded-full px-3 text-xs ${can ? "bg-white text-rose-500" : "bg-white/60 text-ink-500"}`}>{vnD(d.date)}{can ? " · Hủy" : ""}</button> })}</div></div>)}
    {liveLates.map(l => <div key={l.id} className="card flex items-center justify-between gap-2 text-sm" data-testid="sent-late"><span>⏰ Đón muộn {vnD(l.date)} lúc <b>{l.time}</b>{l.pickerName ? ` · ${l.pickerName}` : ""}</span>
      <button className="min-h-12 px-2 text-rose-500 underline" disabled={!!busy} data-testid="sent-late-cancel" onClick={() => run(l.id, "Hủy báo đón muộn?", () => cancelLatePickup(l.id))}>Hủy</button></div>)}</section>;
}

/** "Đã qua": read-only past 30 days, grouped by month. refundEligible shown exactly as the server sent it; confirmed school holidays excluded. */
/** "Đã qua" for medicine / late pickup tabs: read-only, last 30 days, ink-500. */
function PastList({ title, empty, rows }: { title: string; empty: string; rows: { key: string; date: string; text: string; sub: string }[] }) {
  return <section className="space-y-2 text-ink-500" data-testid={`past-${title}`}><h2 className="font-semibold text-ink-700">Trong 30 ngày qua</h2>
    {!rows.length ? <p className="text-sm">{empty}</p> : <div className="card space-y-1">{rows.map(r => <div key={r.key} className="flex min-h-12 items-center gap-3 border-t border-ink-100 py-1 text-sm first:border-t-0">
      <b className="w-24 shrink-0 font-semibold">{vnD(r.date)}</b><span>{r.text}{r.sub && <span className="block text-xs">{r.sub}</span>}</span></div>)}</div>}</section>;
}

function AbsenceHistory({ items, holidays, cutoff, from, to }: { items: Absence[]; holidays: Holiday[]; cutoff: string; from: string; to: string }) {
  const off = new Set(holidays.filter(h => h.status === "confirmed").map(h => h.date));
  const rows = items.flatMap(a => (a.days ?? []).filter(d => !d.cancelled && d.date >= from && d.date <= to && !off.has(d.date)).map(d => ({ a, d })))
    .sort((x, y) => y.d.date.localeCompare(x.d.date));
  const cut = cutoff.replace(/^0(\d)/, "$1"); // "08:00" → "8:00"
  const months = Array.from(new Set(rows.map(r => r.d.date.slice(0, 7))));
  const sent = (iso: string) => fmtDateTime(iso);
  return <section className="space-y-2 text-ink-500" data-testid="absence-history"><h2 className="font-semibold text-ink-700">Báo trước {Number(cut.split(":")[0])} giờ sáng thì trường trả lại tiền ăn</h2><p className="text-sm">Những ngày bé nghỉ trong 30 ngày qua:</p>
    {!rows.length && <p className="text-sm">Không có ngày nghỉ nào trong 30 ngày qua.</p>}
    {months.map(m => { const list = rows.filter(r => r.d.date.startsWith(m)); const refunds = list.filter(r => r.d.refundEligible === true).length;
      return <div key={m} className="card space-y-1" data-testid="absence-history-month">
        <div className="text-sm font-semibold" data-testid="absence-history-summary">Tháng {Number(m.slice(5, 7))} · nghỉ {list.length} ngày · hoàn {refunds} suất ăn</div>
        {list.map(({ a, d }) => <div key={a.id + d.date} className="flex min-h-12 items-center justify-between gap-2 border-t border-ink-100 py-1 text-sm" data-testid="absence-history-day" data-refund={d.refundEligible}>
          <span><b className="font-semibold">{vnD(d.date)}</b> · {ABSENCE_REASONS.find(x => x[0] === a.reason)?.[1] ?? a.reason}
            <span className="block text-xs">Báo lúc {sent(d.reportedAt ?? a.createdAt)}{d.overridden ? " · cô đã điểm có mặt" : ""}</span></span>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${d.refundEligible === true ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-500"}`}>
            {d.refundEligible === true ? "Được hoàn" : `Không hoàn, báo sau ${cut}`}</span></div>)}</div> })}</section>;
}

function Soon({ what }: { what: string }) {
  return <div className="card space-y-2 text-center" data-testid="messages-soon"><div className="text-3xl">🚧</div><b>{what}: sắp có</b>
    <p className="text-sm text-ink-500">Tính năng này đang được hoàn thiện. Trong lúc chờ, bố mẹ vui lòng nhắn hoặc gọi trực tiếp cho cô giáo.</p></div>;
}
