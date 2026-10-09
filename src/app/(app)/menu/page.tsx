"use client";
import { useCallback, useEffect, useState } from "react"; import { api, http, todayStr } from "@/lib/api";
type Meal = "breakfast" | "lunch" | "snack"; const MEALS: [Meal, string, string][] = [["breakfast", "Sáng", "🥣"], ["lunch", "Trưa", "🍚"], ["snack", "Xế", "🍌"]];
type Day = { date: string; meals: Record<Meal, string | null>; allergyNotes: Record<Meal, string | null> };
type Menu = { weekStart: string; weekEnd: string; days: Day[]; allergyAlerts: { childId: string; fullName: string; className: string | null; allergies: string }[] };
const WD = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const shift = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE") };
const dm = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
export default function MenuPage() {
  const me = api.me(); const admin = me?.role === "admin"; const [week, setWeek] = useState(todayStr()); const [m, setM] = useState<Menu | null>(null);
  const [edit, setEdit] = useState(false); const [draft, setDraft] = useState<Day[]>([]); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(() => http.get<Menu>(`/menus?week=${week}`).then(r => { setM(r); setDraft(JSON.parse(JSON.stringify(r.days))) }).catch(e => setMsg(e.message)), [week]);
  useEffect(() => { load() }, [load]);
  const set = (i: number, k: "meals" | "allergyNotes", meal: Meal, v: string) => setDraft(d => d.map((x, j) => j === i ? { ...x, [k]: { ...x[k], [meal]: v } } : x));
  async function save() { if (!m) return; setBusy(true); setMsg("");
    const items = draft.flatMap((d, i) => MEALS.map(([meal]) => ({ d, o: m.days[i], meal }))).filter(({ d, o, meal }) => (d.meals[meal] ?? "") !== (o.meals[meal] ?? "") || (d.allergyNotes[meal] ?? "") !== (o.allergyNotes[meal] ?? ""))
      .map(({ d, meal }) => ({ date: d.date, meal, dishes: d.meals[meal] ?? "", ...(d.allergyNotes[meal] ? { allergyNotes: d.allergyNotes[meal] } : {}) }));
    try { if (items.length) { const r = await http.put<Menu>("/menus", { weekStart: m.weekStart, items }); setM(r); setDraft(JSON.parse(JSON.stringify(r.days))) } setEdit(false); setMsg(items.length ? "Đã lưu thực đơn ✔" : "Không có thay đổi") }
    catch (x) { setMsg("❌ " + (x as Error).message) } finally { setBusy(false) } }
  if (!m) return <p>{msg || "Đang tải…"}</p>;
  const days = (edit ? draft : m.days).filter((d, i) => i < 5 || MEALS.some(([k]) => d.meals[k]) || edit);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Thực đơn tuần {dm(m.weekStart)}–{dm(m.weekEnd)}</h1>
      <div className="flex gap-2"><button className="btn !bg-white !text-ink-700" onClick={() => setWeek(shift(m.weekStart, -7))} aria-label="Tuần trước" data-testid="menu-prev">‹</button>
        <button className="btn !bg-white !text-ink-700" onClick={() => setWeek(todayStr())}>Tuần này</button><button className="btn !bg-white !text-ink-700" onClick={() => setWeek(shift(m.weekStart, 7))} aria-label="Tuần sau" data-testid="menu-next">›</button>
        {admin && !edit && <button className="btn" onClick={() => setEdit(true)} data-testid="btn-edit-menu">✏️ Chỉnh sửa</button>}</div></div>
    {m.allergyAlerts.length > 0 && <div className="card bg-rose-100/60 text-sm"><b>⚠ {me?.role === "parent" ? "Bé có dị ứng" : `${m.allergyAlerts.length} bé có dị ứng`}:</b> {m.allergyAlerts.map(a => `${a.fullName}${a.className ? ` (${a.className})` : ""}: ${a.allergies}`).join(" · ")}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{days.map(d => { const i = m.days.findIndex(x => x.date === d.date); const today = d.date === todayStr();
      return <div key={d.date} className={`card space-y-2 ${today ? "ring-2 ring-mint-500" : ""}`} data-testid="menu-day"><div className="font-semibold text-mint-700">{WD[i]} <span className="text-xs font-normal text-ink-500">{dm(d.date)}{today ? " · hôm nay" : ""}</span></div>
        {MEALS.map(([k, l, ic]) => edit ? <div key={k} className="space-y-1"><label className="text-xs text-ink-500">{ic} {l}</label><input className="input !py-2 text-sm" value={d.meals[k] ?? ""} onChange={e => set(i, "meals", k, e.target.value)} data-testid={`menu-${d.date}-${k}`} />
          <input className="input !py-2 text-xs" placeholder="Món thay thế cho bé dị ứng" value={d.allergyNotes[k] ?? ""} onChange={e => set(i, "allergyNotes", k, e.target.value)} /></div>
          : d.meals[k] ? <div key={k} className="text-sm"><span className="text-ink-500">{ic} {l}:</span> {d.meals[k]}{d.allergyNotes[k] && <div className="mt-1 rounded-xl bg-rose-100 px-2 py-1 text-xs text-rose-500" data-testid="allergy-sub">🔄 {d.allergyNotes[k]}</div>}</div> : null)}
        {!edit && !MEALS.some(([k]) => d.meals[k]) && <p className="text-sm text-ink-300">Chưa có thực đơn</p>}</div> })}</div>
    {edit && <div className="flex gap-2"><button className="btn flex-1" disabled={busy} onClick={save} data-testid="btn-save-menu">Lưu thực đơn</button><button className="btn flex-1 !bg-ink-300" onClick={() => { setEdit(false); setDraft(JSON.parse(JSON.stringify(m.days))) }}>Hủy</button></div>}
    {msg && <p className="text-sm" data-testid="menu-msg">{msg}</p>}</div>;
}
