"use client";
/** Admin assigns the "trực đón" account per day (this week + next week). The duty account may approve the school step only on its day. */
import { useCallback, useEffect, useState } from "react"; import { http, todayStr } from "@/lib/api";
import { assignDuty, Duty, listDuties, removeDuty } from "@/lib/pickup-api";

type U = { id: string; name: string; role: string; active?: boolean };
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE") };
const monday = (d: string) => { const x = new Date(d + "T00:00:00"); return addDays(d, -((x.getDay() + 6) % 7)) };
export function DutyPlanner() {
  const [start, setStart] = useState(() => monday(todayStr())); const days = Array.from({ length: 6 }, (_, i) => addDays(start, i)); // T2–T7
  const [duties, setDuties] = useState<Duty[]>([]); const [users, setUsers] = useState<U[]>([]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(() => listDuties(start, addDays(start, 6)).then(setDuties).catch(e => setErr(e.message)), [start]);
  useEffect(() => { load() }, [load]);
  useEffect(() => { Promise.all(["teacher", "accountant", "admin"].map(r => http.get<{ items: U[] }>(`/users?role=${r}&active=true&limit=200`).then(x => x.items).catch(() => [] as U[])))
    .then(a => setUsers(a.flat())) }, []);
  const add = async (date: string, userId: string) => { if (!userId) return; setBusy(true); setErr(""); try { await assignDuty(userId, [date]); load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  const del = async (d: Duty) => { setBusy(true); try { await removeDuty(d.id); load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  return <section className="card space-y-3" data-testid="duty-planner">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Lịch trực đón</h2>
      <div className="flex gap-1"><button className="min-h-12 min-w-12 rounded-xl bg-ink-100" onClick={() => setStart(addDays(start, -7))}>‹</button><button className="min-h-12 min-w-12 rounded-xl bg-ink-100" onClick={() => setStart(addDays(start, 7))}>›</button></div></div>
    <p className="text-xs text-ink-500">Tài khoản trực đón được duyệt phần nhà trường cho yêu cầu đón của đúng ngày trực. Người đã duyệt không được tự giao bé.</p>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    {days.map(d => { const ds = duties.filter(x => x.date === d); const past = d < todayStr();
      return <div key={d} className={`flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2 ${d === todayStr() ? "rounded-xl bg-mint-50 p-2" : ""}`} data-testid="duty-day" data-date={d}>
        <span className="w-24 text-sm font-semibold">{new Date(d + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" })}</span>
        {ds.map(x => <span key={x.id} className="flex items-center gap-1 rounded-full bg-mint-100 px-3 py-1 text-sm text-mint-700">🛡️ {x.userName}
          {!past && <button className="min-h-8 px-1 text-rose-500" aria-label={`Bỏ ${x.userName}`} disabled={busy} onClick={() => del(x)}>✕</button>}</span>)}
        {!past && <select className="input !w-auto min-h-12 text-sm" value="" disabled={busy} onChange={e => add(d, e.target.value)} data-testid="duty-add">
          <option value="">+ Phân công…</option>{users.filter(u => !ds.some(x => x.userId === u.id)).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role === "teacher" ? "GV" : u.role === "admin" ? "Ban giám hiệu" : "KT"})</option>)}</select>}</div> })}
  </section>;
}
