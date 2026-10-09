"use client";
/**
 * Nhật ký ngày (đợt 2): pick several children, write once, save one record per child. Backend PUT is partial
 * (omitted field = kept, null = cleared), so we send ONLY the fields the teacher changed. Group note is appended to an
 * existing different note; asks before overwriting kids that already have a value. Absent kids are skipped by "Chọn tất cả".
 */
import { DateField } from "@/components/DateField"; import { useCallback, useEffect, useState } from "react"; import { api, http, todayStr } from "@/lib/api"; import { ClassRoom } from "@/lib/types";
import { AutoTextarea } from "@/components/AutoTextarea"; import { msgFeatures, NOTE_BREAKFAST_FIELD, TOILET } from "@/lib/messages-api";
import { EAT, Eat, MOODS, sleepText } from "./shared";
type Note = { childId: string; fullName: string; recorded: boolean; eating: Eat | null; breakfast?: Eat | null; sleepMinutes: number | null; mood: string | null; toilet: string | null; note: string | null };
type Draft = { breakfast: Eat | null; eating: Eat | null; sleepMinutes: number | null; mood: string | null; toilet: string | null; note: string };
const EMPTY: Draft = { breakfast: null, eating: null, sleepMinutes: null, mood: null, toilet: null, note: "" };
const SLEEP = [0, 60, 90, 120, 150];
const EAT3: Eat[] = ["all", "half", "none"]; // mockup: Hết / Một nửa / Không ăn (full scale on "Thêm")

export default function NotesPage() {
  const me = api.me()!; const [classes, setClasses] = useState<ClassRoom[]>([]); const [classId, setClassId] = useState(""); const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<Note[]>([]); const [absent, setAbsent] = useState<Set<string>>(new Set()); const [sel, setSel] = useState<Set<string>>(new Set());
  const [d, setD] = useState<Draft>(EMPTY); const [msg, setMsg] = useState(""); const [hasBreakfast, setHasBreakfast] = useState(false);
  useEffect(() => { msgFeatures().then(f => setHasBreakfast(f.breakfast)) }, []); const [busy, setBusy] = useState(false);
  useEffect(() => { api.classes().then(c => { const mine = me.role === "teacher" ? c.filter(x => me.classIds?.includes(x.id)) : c; setClasses(mine); setClassId(mine[0]?.id ?? "") }).catch(() => {}) }, [me.role, me.classIds]);
  const load = useCallback(() => { if (!classId) return;
    http.get<{ items: Note[] }>(`/classes/${classId}/daily-notes?date=${date}`).then(r => { setRows(r.items); setSel(new Set()); setD(EMPTY) }).catch(e => setMsg(e.message));
    http.get<{ items: { childId: string; status: string | null }[] }>(`/classes/${classId}/attendance?date=${date}`).then(r => setAbsent(new Set(r.items.filter(i => i.status === "absent").map(i => i.childId)))).catch(() => {}) }, [classId, date]);
  useEffect(() => { load() }, [load]);
  const picked = rows.filter(r => sel.has(r.childId));
  // one child selected → edit its own values; several → start blank (blank = keep each child's value)
  const pick = (ids: Set<string>) => { setSel(ids); setMsg(""); const one = ids.size === 1 ? rows.find(r => ids.has(r.childId)) : null;
    setD(one ? { breakfast: one.breakfast ?? null, eating: one.eating, sleepMinutes: one.sleepMinutes, mood: one.mood, toilet: one.toilet, note: one.note ?? "" } : EMPTY) };
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); pick(n) };
  const allHere = rows.filter(r => !absent.has(r.childId)).map(r => r.childId);
  const allOn = allHere.length > 0 && allHere.every(id => sel.has(id));
  async function save() { if (!picked.length) return; setMsg("");
    const single = picked.length === 1; const fields = ["eating", "sleepMinutes", "mood", "toilet", ...(hasBreakfast ? ["breakfast"] : [])] as const;
    const items = picked.map(r => { const o: Record<string, unknown> = { childId: r.childId }; const cur = r as unknown as Record<string, unknown>;
      for (const k of fields) { const v = (d as unknown as Record<string, unknown>)[k === "breakfast" ? "breakfast" : k];
        if (single ? (v ?? null) !== (cur[k === "breakfast" ? NOTE_BREAKFAST_FIELD : k] ?? null) : v != null) o[k === "breakfast" ? NOTE_BREAKFAST_FIELD : k] = v ?? null } // single: null clears
      const n = d.note.trim(), old = (r.note ?? "").trim();
      if (single ? n !== old : !!n) o.note = single ? (n || null) : !old || old.includes(n) ? (old || n) : `${old}\n${n}`;
      return o }).filter(o => Object.keys(o).length > 1);
    if (!items.length) { setMsg("Chưa có gì thay đổi"); return }
    const over = single ? [] : picked.filter(r => fields.some(k => (d as unknown as Record<string, unknown>)[k] != null && (r as unknown as Record<string, unknown>)[k === "breakfast" ? NOTE_BREAKFAST_FIELD : k] != null && (r as unknown as Record<string, unknown>)[k === "breakfast" ? NOTE_BREAKFAST_FIELD : k] !== (d as unknown as Record<string, unknown>)[k]));
    if (over.length && !confirm(`${over.length} bé đã có nhật ký khác hôm nay (${over.map(r => r.fullName.split(" ").pop()).join(", ")}).\nMục bạn chọn sẽ thay giá trị cũ, mục để trống giữ nguyên, ghi chú được nối thêm. Tiếp tục?`)) return;
    const skipped = picked.filter(r => absent.has(r.childId));
    setBusy(true);
    try { await http.put(`/classes/${classId}/daily-notes`, { date, items }); setMsg(`Đã lưu cho ${items.length} bé ✔${skipped.length ? ` (gồm ${skipped.length} bé vắng)` : ""}`); load() }
    catch (x) { setMsg("❌ " + (x as Error).message) } finally { setBusy(false) } }
  const done = rows.filter(r => r.recorded).length;
  const chip = (on: boolean, cls = "bg-mint-500") => `min-h-12 rounded-xl text-sm ${on ? `${cls} font-semibold text-white` : "bg-ink-100"}`;
  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-2xl font-bold">Nhật ký ngày</h1>
      <div className="text-sm text-ink-500">{sel.size ? `Đã chọn ${sel.size} bé · ghi chung một lần` : "Chọn một hoặc nhiều bé"}</div></div>
      <span className="text-sm text-ink-500" data-testid="notes-progress">Đã ghi {done}/{rows.length} bé</span></div>
    <div className="flex flex-wrap gap-2">{classes.length > 1 && <select className="input !w-auto" value={classId} onChange={e => setClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      <DateField className="w-44" value={date} max={todayStr()} onChange={v => { if (v) setDate(v) }} /></div>
    <div className="flex flex-wrap gap-2" data-testid="notes-pick">
      <button onClick={() => pick(allOn ? new Set() : new Set(allHere))} className={`min-h-12 rounded-full px-4 text-sm ${allOn ? "bg-mint-500 text-white" : "bg-mint-100 text-mint-700"}`} data-testid="notes-select-all">{allOn ? "✓ Bỏ chọn" : "✓ Chọn tất cả"}</button>
      {rows.map(r => <button key={r.childId} onClick={() => toggle(r.childId)} data-testid="notes-kid" data-selected={sel.has(r.childId)}
        className={`min-h-12 rounded-full px-4 text-sm ${sel.has(r.childId) ? "bg-mint-500 text-white" : absent.has(r.childId) ? "bg-ink-100 text-ink-500 line-through" : r.recorded ? "bg-mint-100" : "bg-white ring-1 ring-ink-100"}`}>
        {r.fullName.split(" ").pop()}{r.recorded && !sel.has(r.childId) ? " ✓" : ""}</button>)}</div>
    {picked.some(r => absent.has(r.childId)) && <p className="rounded-xl bg-sun-100 p-2 text-sm" data-testid="notes-absent-warning">⚠ Có bé vắng hôm nay trong nhóm chọn: {picked.filter(r => absent.has(r.childId)).map(r => r.fullName).join(", ")}</p>}
    {sel.size > 0 && <div className="card space-y-4" data-testid="note-card">
      {sel.size > 1 && <p className="text-xs text-ink-500">Mục để trống giữ nguyên dữ liệu cũ của từng bé. Ghi chú được nối thêm vào ghi chú đã có.</p>}
      {hasBreakfast && <div><div className="mb-1 text-xs text-ink-500">🥣 Ăn sáng</div><div className="grid grid-cols-3 gap-2">{EAT3.map(v => <button key={v} onClick={() => setD({ ...d, breakfast: d.breakfast === v ? null : v })} data-testid={`breakfast-${v}`} className={chip(d.breakfast === v)}>{v === "all" ? "Hết" : EAT.find(e => e[0] === v)?.[1]}</button>)}</div></div>}
      <div><div className="mb-1 text-xs text-ink-500">🍚 Ăn trưa</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{EAT.map(([v, l]) => <button key={v} onClick={() => setD({ ...d, eating: d.eating === v ? null : v })} data-testid={`eat-${v}`} className={chip(d.eating === v)}>{l}</button>)}</div></div>
      <div><div className="mb-1 text-xs text-ink-500">😴 Ngủ trưa</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-testid="sleep-options">{SLEEP.map(v => <button key={v} onClick={() => setD({ ...d, sleepMinutes: d.sleepMinutes === v ? null : v })} data-testid={`sleep-${v}`} className={chip(d.sleepMinutes === v, "bg-sky-500")}>{sleepText(v)}</button>)}</div></div>
      <div><div className="mb-1 text-xs text-ink-500">🚽 Đi vệ sinh</div><div className="grid grid-cols-3 gap-2">{TOILET.map(v => <button key={v} onClick={() => setD({ ...d, toilet: d.toilet === v ? null : v })} data-testid={`toilet-${v}`} className={chip(d.toilet === v)}>{v}</button>)}</div>{d.toilet && !TOILET.includes(d.toilet) && <p className="mt-1 text-xs text-ink-500" data-testid="toilet-legacy">Đang ghi: “{d.toilet}”</p>}</div>
      <div><div className="mb-1 text-xs text-ink-500">Tâm trạng</div><div className="flex gap-2">{MOODS.map(([v, e]) => <button key={v} title={v} aria-label={v} onClick={() => setD({ ...d, mood: d.mood === v ? null : v })} data-testid={`mood-${e}`} className={`h-12 w-12 rounded-xl text-2xl ${d.mood === v ? "bg-sun-100 ring-2 ring-sun-500" : "bg-ink-100"}`}>{e}</button>)}</div></div>
      <div><div className="mb-1 text-xs text-ink-500">Ghi chú {d.note.length > 400 && <span>({d.note.length}/1000)</span>}</div>
        <AutoTextarea placeholder="Ghi chú cho phụ huynh (không bắt buộc)" value={d.note} maxLength={1000} onChange={e => setD({ ...d, note: e.target.value })} data-testid="note-text" /></div></div>}
    {msg && <p className="text-sm" data-testid="notes-msg">{msg}</p>}{rows.length === 0 && <p className="text-ink-500">Lớp chưa có bé</p>}
    <div className="sticky bottom-20 md:bottom-4"><button className="btn min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100 shadow-pop" disabled={busy || !sel.size} onClick={save} data-testid="btn-save-notes">{busy ? "Đang lưu…" : sel.size ? `Lưu cho ${sel.size} bé` : "Chọn bé để ghi"}</button></div></div>;
}
