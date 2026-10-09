"use client";
import { DateField } from "@/components/DateField"; import { useCallback, useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
import { api, http, todayStr } from "@/lib/api"; import { Child } from "@/lib/types"; import { Photo, WithdrawnBadge } from "@/components/Photo"; import { vnDate } from "@/lib/fmt";
import { Growth, GrowthChart, bmiClass } from "../GrowthChart";
export default function ChildHealth() {
  const { id } = useParams<{ id: string }>(); const me = api.me()!; const staff = me.role === "admin" || me.role === "teacher";
  const [c, setC] = useState<Child & { healthNotes?: string | null } | null>(null); const [g, setG] = useState<Growth[]>([]); const [err, setErr] = useState(""); const [form, setForm] = useState(false); const [msg, setMsg] = useState("");
  const load = useCallback(() => { http.get<typeof c>(`/children/${id}`).then(setC).catch(e => setErr(e.message)); http.get<Growth[]>(`/children/${id}/growth`).then(setG).catch(e => setErr(e.message)) }, [id]);
  useEffect(() => { load() }, [load]);
  async function add(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const num = (k: string) => { const v = String(f.get(k) ?? "").replace(",", "."); return v ? Number(v) : undefined };
    setMsg(""); try { await http.post(`/children/${id}/growth`, { date: f.get("date"), heightCm: num("heightCm"), weightKg: num("weightKg"), ...(String(f.get("note")).trim() ? { note: String(f.get("note")).trim() } : {}) }); setForm(false); setMsg("Đã lưu số đo ✔"); load() } catch (x) { setMsg("❌ " + (x as Error).message) } }
  async function del(gid: string) { if (!confirm("Xóa số đo này?")) return; try { await http.del(`/growth/${gid}`); load() } catch (x) { setMsg("❌ " + (x as Error).message) } }
  if (err) return <p className="text-rose-500">{err}</p>; if (!c) return <p>Đang tải…</p>;
  const last = g[g.length - 1]; const [bl, bc] = bmiClass(last?.bmi);
  return <div className="mx-auto max-w-3xl space-y-4">
    <Link href={me.role === "parent" ? "/today" : "/health"} className="text-sm text-mint-700">‹ {me.role === "parent" ? "Bé hôm nay" : "Sức khỏe"}</Link>
    <div className="card flex flex-wrap items-center gap-4"><Photo url={c.photoUrl} id={c.id} size={64} withdrawn={c.status === "withdrawn"} /><div className="flex-1"><h1 className="text-xl font-bold">Tăng trưởng · {c.fullName} {c.status === "withdrawn" && <WithdrawnBadge />}</h1>
      <div className="text-sm text-ink-500">{c.className} · Sinh {vnDate(c.dob)}</div>{c.allergies && <span className="mt-1 inline-block rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-500">⚠ Dị ứng: {c.allergies}</span>}</div>
      {staff && <button className="btn !bg-peach-500 disabled:!bg-ink-100" onClick={() => setForm(!form)} data-testid="btn-add-growth">+ Ghi số đo</button>}</div>
    {form && <form onSubmit={add} className="card grid grid-cols-2 gap-2 bg-peach-50 sm:grid-cols-4"><label className="col-span-2 text-sm sm:col-span-1">Ngày đo<DateField name="date" defaultValue={todayStr()} max={todayStr()} required data-testid="growth-date" /></label>
      <label className="text-sm">Cân nặng (kg)<input name="weightKg" className="input" inputMode="decimal" placeholder="16.2" data-testid="growth-weight" /></label><label className="text-sm">Chiều cao (cm)<input name="heightCm" className="input" inputMode="decimal" placeholder="102" data-testid="growth-height" /></label>
      <label className="col-span-2 text-sm sm:col-span-1">Ghi chú<input name="note" className="input" /></label><button className="btn col-span-2 sm:col-span-4" data-testid="btn-save-growth">Lưu số đo</button></form>}
    {msg && <p className="text-sm" data-testid="growth-msg">{msg}</p>}
    <div className="grid grid-cols-3 gap-3"><div className="rounded-2xl bg-mint-50 p-3"><div className="text-xs">Cân nặng</div><b className="text-xl">{last?.weightKg != null ? `${last.weightKg}kg` : "Chưa cân"}</b></div>
      <div className="rounded-2xl bg-sky-100 p-3"><div className="text-xs">Chiều cao</div><b className="text-xl">{last?.heightCm != null ? `${last.heightCm}cm` : "Chưa đo"}</b></div>
      <div className="rounded-2xl bg-sun-100 p-3"><div className="text-xs">BMI</div><b className="text-xl" data-testid="bmi">{last?.bmi ?? "Chưa có"}</b> <span className={`text-xs font-semibold ${bc}`}>{bl}</span></div></div>
    <div className="card"><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Biểu đồ tăng trưởng</h2><div className="flex gap-3 text-xs"><span className="text-peach-600">● Cân nặng</span><span className="text-sky-500">┅ Chiều cao</span></div></div><GrowthChart data={g} />
      <p className="mt-1 text-xs text-ink-500">Phân loại BMI chỉ mang tính tham khảo cho trẻ 3–6 tuổi.</p></div>
    {c.healthNotes && <div className="card text-sm"><b>Ghi chú sức khỏe:</b> {c.healthNotes}</div>}
    {g.length > 0 && <div className="card"><h2 className="mb-2 font-semibold">Lịch sử số đo</h2><table className="w-full text-sm"><thead className="text-ink-500"><tr><th className="text-left">Ngày</th><th>Cao</th><th>Nặng</th><th>BMI</th>{staff && <th></th>}</tr></thead>
      <tbody>{[...g].reverse().map(x => <tr key={x.id} className="border-t border-ink-100 text-center" data-testid="growth-row"><td className="py-2 text-left">{vnDate(x.date)}{x.note && <div className="text-xs text-ink-500">{x.note}</div>}</td><td>{x.heightCm ?? <span className="text-ink-500">Chưa đo</span>}</td><td>{x.weightKg ?? <span className="text-ink-500">Chưa cân</span>}</td><td>{x.bmi ?? "–"}</td>
        {staff && <td><button className="min-h-12 px-3 text-rose-500" onClick={() => del(x.id)} aria-label="Xóa">✕</button></td>}</tr>)}</tbody></table></div>}
  </div>;
}
