"use client";
/**
 * Điểm danh (đợt 2): parent messages pinned on top; kids reported absent auto "Vắng có phép" (sky); "Cả lớp có mặt" only fills
 * kids still "Chưa điểm" (never overwrites excused / already-marked); absence reason chips; 💊 / ⏰ icons; "Đã cho uống" per dose.
 * "Vắng có phép" = status absent + notifiedInAdvance (existing API).
 */
import { useCallback, useEffect, useState } from "react"; import Link from "next/link";
import { api, http } from "@/lib/api"; import { ClassRoom } from "@/lib/types";
import { getTodayClosure, TodayClosure } from "@/lib/messages-api"; import { AbsenceReason, absentOn, ABSENCE_REASONS, classMessages, ClassMessages, emptyClassMessages, msgErrorText, msgFeatures, vnToday } from "@/lib/messages-api";
import { MedicineDoses } from "@/components/MedicineDoses";

type St = "unset" | "present" | "absent" | "excused" | "late";
type Sheet = { childId: string; fullName: string; allergies?: string; status: "present" | "absent" | "late" | null; note: string | null; notifiedInAdvance: boolean; recorded: boolean;
  /** round2 §5 (absent before 2b ships) */ excused?: boolean; absenceReason?: string | null; absenceId?: string | null; absenceNote?: string | null; refundEligible?: boolean; photoConsent?: boolean; /** b205e5d */ excusedBy?: "parent" | "teacher" | null };
type Row = { by?: "parent" | "teacher" | null; reason?: AbsenceReason | null; childId: string; fullName: string; allergies?: string; st: St; note: string; orig: St; origNote: string; auto?: boolean };
const NEXT: Record<St, St> = { unset: "present", present: "absent", absent: "late", late: "present", excused: "present" };
const STYLE: Record<St, string> = { unset: "border-2 border-dashed border-ink-300 text-ink-500", present: "bg-mint-500 text-white", absent: "bg-rose-500 text-white", excused: "bg-sky-100 text-sky-500 ring-1 ring-sky-500", late: "bg-sun-500 text-ink-900" };
const LABEL: Record<St, string> = { unset: "Chưa điểm", present: "Có mặt", absent: "Vắng", excused: "Vắng có phép", late: "Đi muộn" };
const ABSENT_CHIPS = ["Không báo", "Ốm", "Việc nhà"];
const CHIP_REASON: Record<string, AbsenceReason> = { "Ốm": "sick", "Việc nhà": "family" };
const asReason = (v?: string | null): AbsenceReason | null => v === "sick" || v === "family" || v === "other" ? v : null;
const reasonText = (r: string) => ABSENCE_REASONS.find(x => x[0] === r)?.[1].replace(/^\S+\s/, "") ?? r;

export default function AttendancePage() {
  const me = api.me()!; const today = vnToday();
  const [classes, setClasses] = useState<ClassRoom[]>([]); const [classId, setClassId] = useState("");
  const [holiday, setHoliday] = useState<{ id: string; name: string } | null>(null); const [closure, setClosure] = useState<TodayClosure | null>(null);
  useEffect(() => { if (holiday) getTodayClosure().then(c => setClosure(c && c.id === holiday.id ? c : null)); else setClosure(null) }, [holiday]); const [override, setOverride] = useState(false);
  const [rows, setRows] = useState<Row[]>([]); const [msgs, setMsgs] = useState<ClassMessages | null>(null); const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { api.classes().then(c => { const mine = me.role === "teacher" ? c.filter(x => me.classIds?.includes(x.id)) : c; setClasses(mine); const want = new URLSearchParams(window.location.search).get("class"); setClassId(mine.find(x => x.id === want)?.id ?? mine[0]?.id ?? "") }) }, [me.role, me.classIds]);
  const load = useCallback(async (keepMsg = false) => { if (!classId) return; if (!keepMsg) setMsg("");
    try { const [s, m, ft] = await Promise.all([http.get<{ items: Sheet[]; holiday?: { id: string; name: string; status?: string } | null }>(`/classes/${classId}/attendance?date=${today}`),
        msgFeatures().then(ft => ft.classMessages ? classMessages(classId, today) : emptyClassMessages(today)), msgFeatures()]);
      setMsgs(m); setHoliday(s.holiday && s.holiday.status !== "pending" ? s.holiday : null); setOverride(ft.overrideAbsence); // only confirmed holidays count
      setRows(s.items.map(i => { const exc = i.excusedBy !== undefined ? !!i.excused : i.excused !== undefined ? i.excused || !!i.absenceReason : i.notifiedInAdvance; // server first (b205e5d)
        const orig: St = !i.status ? "unset" : i.status === "absent" && exc ? "excused" : i.status; const by = i.excusedBy ?? null;
        // round2: `excused` = parent report; a teacher-set "Vắng có phép" is absent + absenceReason. Legacy: notifiedInAdvance.
        const ab = m.absences.find(a => a.childId === i.childId && absentOn(a, today));
        // auto "Vắng có phép" only for kids not yet marked: never overwrite the teacher's mark (ABS-10/13)
        if (orig === "unset" && ab) return { childId: i.childId, fullName: i.fullName, allergies: i.allergies, st: "excused", note: [reasonText(ab.reason), ab.note].filter(Boolean).join(": "), orig, origNote: i.note ?? "", auto: true, reason: asReason(ab.reason), by: "parent" };
        return { childId: i.childId, fullName: i.fullName, allergies: i.allergies, st: orig, note: i.note ?? "", orig, origNote: i.note ?? "", reason: asReason(i.absenceReason), by } })) }
    catch (e) { setMsg((e as Error).message) } }, [classId, today]);
  useEffect(() => { load() }, [load]);
  const set = (id: string, p: Partial<Row>) => setRows(rs => rs.map(r => r.childId === id ? { ...r, ...p, auto: false } : r));
  const allPresent = () => setRows(rs => rs.map(r => r.st === "unset" ? { ...r, st: "present" } : r)); // ATT2-01
  const count = (s: St) => rows.filter(r => r.st === s).length;
  const dirty = rows.filter(r => r.st !== "unset" && (r.st !== r.orig || r.note !== r.origNote));
  async function save() {
    // §5: marking present/late on a parent-reported (excused) day is an explicit override → no meal refund; backend skips it unless overrideAbsence
    const over = dirty.filter(r => r.orig === "excused" && (r.st === "present" || r.st === "late"));
    if (over.length && !confirm(`${over.map(r => r.fullName).join(", ")} đã được báo nghỉ có phép. Điểm có mặt thì ngày này sẽ KHÔNG được hoàn tiền ăn. Tiếp tục?`)) return;
    setSaving(true); setMsg("");
    // round2 (override = DTO has absenceReason/overrideAbsence): excused → absenceReason; the server decides refunds. Legacy backend: notifiedInAdvance.
    const item = (r: Row) => { const status = r.st === "excused" ? "absent" : r.st, note = r.note.trim() || null;
      if (!override) return { childId: r.childId, status, notifiedInAdvance: r.st === "excused", note };
      // excused → reason; excused changed to plain Vắng / present / late → absenceReason: null (explicit clear; omitted = server keeps the old one)
      const reason = r.st === "excused" ? { absenceReason: r.reason ?? CHIP_REASON[r.note.trim()] ?? "other" } : r.orig === "excused" ? { absenceReason: null } : {};
      return { childId: r.childId, status, note, ...reason, ...(over.includes(r) ? { overrideAbsence: true } : {}) } };
    try { const res = await http.put<{ skipped?: { childId: string; reason: string }[] } | null>(`/classes/${classId}/attendance`, { date: today, items: dirty.map(item) });
      const sk = res?.skipped ?? [];
      setMsg(`✓ Đã lưu điểm danh (${dirty.length - sk.length} bé)${sk.length ? ` · bỏ qua ${sk.length} bé đã báo nghỉ: ${sk.map(x => rows.find(r => r.childId === x.childId)?.fullName ?? "").join(", ")}` : ""}`); load(true) }
    catch (e) { setMsg(msgErrorText(e)) } finally { setSaving(false) } }
  const medOf = (id: string) => msgs?.medicines.some(m => m.childId === id); const lateOf = (id: string) => msgs?.latePickups.find(l => l.childId === id);
  const nMsgs = msgs ? msgs.absences.filter(a => absentOn(a, today)).length + msgs.medicines.length + msgs.latePickups.length : 0;
  const unset = count("unset");
  return <div className="mx-auto max-w-5xl space-y-3">
    <div className="-mx-4 -mt-4 bg-mint-500 px-4 py-3 text-white md:mx-0 md:mt-0 md:rounded-2xl"><div className="text-sm opacity-90">{classes.find(c => c.id === classId)?.name} · {today.split("-").reverse().slice(0, 2).join("/")}</div><h1 className="text-2xl font-bold">Điểm danh</h1></div>
    {holiday && (closure?.kind === "emergency" || msgs?.holiday?.kind === "emergency"
      ? <div role="alert" className="rounded-2xl border-l-4 border-rose-500 bg-rose-100 p-4 text-rose-500" data-testid="att-closure">
          <b>⚠ Trường nghỉ đột xuất hôm nay</b>{(closure?.reason ?? msgs?.holiday?.reason) && <p className="text-ink-900">{closure?.reason ?? msgs?.holiday?.reason}</p>}
          <p className="mt-1 text-sm text-ink-700">Không điểm danh thêm. Điểm danh đã ghi trước khi đóng cửa được giữ nguyên.</p></div>
      : <p className="rounded-2xl bg-peach-100 p-4 text-center font-semibold text-peach-600" data-testid="att-holiday">🏖️ Trường nghỉ: {holiday.name}. Hôm nay không điểm danh.</p>)}
    {classes.length > 1 && <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    {msgs && nMsgs > 0 && <section className="card space-y-2 border-l-4 border-peach-500" data-testid="att-messages"><b>📬 {nMsgs} lời nhắn hôm nay</b>
      {msgs.absences.filter(a => absentOn(a, today)).map(a => <div key={a.id} className="text-sm" data-testid="att-msg-absence">🛌 <b>{a.childName ?? rows.find(r => r.childId === a.childId)?.fullName}</b> nghỉ {reasonText(a.reason)}{a.note ? `: ${a.note}` : ""} → <span className="text-sky-500">đã tự đánh Vắng có phép</span></div>)}
      {msgs.latePickups.map(l => <div key={l.id} className="text-sm" data-testid="att-msg-late">⏰ <b>{l.childName ?? rows.find(r => r.childId === l.childId)?.fullName}</b> đón muộn {l.time}{l.pickerName ? ` (${l.pickerName})` : ""}{l.note ? ` · ${l.note}` : ""}</div>)}
      {msgs.medicines.map(m => <MedicineDoses key={m.id} m={{ ...m, childName: m.childName ?? rows.find(r => r.childId === m.childId)?.fullName }} onChange={() => load()} />)}</section>}
    <button className="min-h-14 w-full rounded-2xl bg-mint-100 font-semibold text-mint-700 disabled:opacity-50" disabled={!unset || !!holiday} onClick={allPresent} data-testid="att-all-present">
      ✓ Cả lớp có mặt {unset ? `(${unset} bé chưa điểm` : "(đã điểm hết"}{count("excused") ? `, trừ bé đã báo nghỉ)` : ")"}</button>
    <div className="flex flex-wrap gap-2 text-sm">{(["present", "excused", "absent", "late", "unset"] as St[]).map(s => <span key={s} className={`whitespace-nowrap rounded-full px-3 py-1 ${STYLE[s]}`}>{LABEL[s]}: {count(s)}</span>)}</div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r => <div key={r.childId} className="card space-y-2" data-testid="att-row" data-status={r.st}>
      <button onClick={() => set(r.childId, { st: NEXT[r.st], note: NEXT[r.st] === "absent" ? r.note : r.st === "excused" || r.st === "absent" ? "" : r.note })} className="flex min-h-12 w-full items-center justify-between gap-2 text-left active:scale-[0.98] transition">
        <span className="font-medium">{r.fullName}{medOf(r.childId) && <span title="Có dặn thuốc"> 💊</span>}{lateOf(r.childId) && <span title={`Đón muộn ${lateOf(r.childId)!.time}`}> ⏰</span>}</span>
        <span className={`flex min-h-12 min-w-28 items-center justify-center rounded-xl px-3 text-sm font-semibold ${STYLE[r.st]}`}>{LABEL[r.st]}</span></button>
      {r.st === "excused" && (() => { const by = r.auto ? "parent" : r.st === r.orig ? r.by : "teacher";
        return <p className="text-xs text-sky-500" data-testid="att-excused-by">{by && <span className="mr-1 rounded-full bg-sky-100 px-2 py-0.5 font-semibold">{by === "parent" ? "PH báo" : "Cô ghi"}</span>}{r.note}</p> })()}
      {r.st === "absent" && <div className="flex flex-wrap gap-1" data-testid="att-reasons">{ABSENT_CHIPS.map(c => <button key={c} onClick={() => set(r.childId, { note: c })} className={`min-h-12 rounded-full px-3 text-xs ${r.note === c ? (c === "Không báo" ? "bg-rose-500 text-white" : "bg-ink-900 text-white") : "bg-ink-100"}`}>{c}</button>)}
        <button onClick={() => set(r.childId, { st: "excused" })} className="min-h-12 rounded-full bg-sky-100 px-3 text-xs text-sky-500">Có phép</button></div>}</div>)}</div>
    {msg && <p role="status" className={`rounded-xl p-3 text-center text-sm font-semibold ${msg.startsWith("✓") ? "bg-mint-50 text-mint-700" : "bg-rose-100 text-rose-500"}`} data-testid="att-msg">{msg}</p>}
    <button className="btn sticky bottom-20 min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100 shadow-lg md:bottom-4" disabled={saving || !dirty.length || !!holiday} onClick={save} data-testid="att-save">{saving ? "Đang lưu…" : `Lưu điểm danh${dirty.length ? ` (${dirty.length})` : ""}`}</button>
    <Link href="/pickups" className="block text-center text-sm text-mint-700 underline">Giao bé ›</Link>
  </div>;
}
