"use client";
/** U3: chi tiết cho phụ huynh – điểm danh & nhật ký 14 ngày gần nhất của bé. /today/log/:id?tab=attendance|notes */
import { useEffect, useState } from "react"; import Link from "next/link"; import { http, todayStr } from "@/lib/api"; import { vnDate } from "@/lib/fmt"; import { EAT, sleepText } from "../../../notes/shared";
type Att = { date: string; status: string | null; note: string | null; pickup: { pickedUpByName: string; pickedUpAt: string } | null };
type Note = { date: string; eating: string | null; sleepMinutes: number | null; mood: string | null; toilet: string | null; note: string | null };
const ST: Record<string, [string, string]> = { present: ["bg-mint-100 text-mint-700", "Có mặt"], late: ["bg-sun-100 text-ink-900", "Đến muộn"], absent: ["bg-rose-100 text-rose-500", "Nghỉ"] };
const back = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10) };
const wd = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("vi-VN", { weekday: "short", timeZone: "UTC" });
export default function ChildLog({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<"attendance" | "notes">("attendance"); const [att, setAtt] = useState<Att[] | null>(null); const [notes, setNotes] = useState<Note[] | null>(null);
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t === "notes") setTab("notes") }, []);
  useEffect(() => { const to = todayStr(), from = back(to, 14);
    http.get<Att[]>(`/children/${params.id}/attendance?from=${from}&to=${to}`).then(a => setAtt([...a].sort((x, y) => y.date.localeCompare(x.date)))).catch(() => setAtt([]));
    http.get<Note[]>(`/children/${params.id}/daily-notes?from=${from}&to=${to}`).then(n => setNotes([...n].sort((x, y) => y.date.localeCompare(x.date)))).catch(() => setNotes([])) }, [params.id]);
  const tb = (on: boolean) => `min-h-12 flex-1 rounded-xl text-[17px] font-semibold ${on ? "bg-mint-500 text-white" : "bg-white"}`;
  return <div className="mx-auto max-w-md space-y-3 text-[17px]" data-testid="child-log">
    <Link href="/today" className="inline-flex min-h-12 items-center text-mint-700">‹ Hôm nay</Link>
    <div className="flex gap-2"><button className={tb(tab === "attendance")} onClick={() => setTab("attendance")} data-testid="log-tab-att">✅ Điểm danh</button><button className={tb(tab === "notes")} onClick={() => setTab("notes")} data-testid="log-tab-notes">📝 Nhật ký</button></div>
    {tab === "attendance" && (att === null ? <p className="text-ink-500">Đang tải…</p> : att.length === 0 ? <p className="text-ink-500">Chưa có điểm danh trong 2 tuần qua</p> :
      att.map(a => { const s = ST[a.status ?? ""] ?? ["bg-ink-100 text-ink-500", "Chưa điểm danh"]; return <div key={a.date} className="card flex items-start justify-between gap-2"><div><b>{wd(a.date)} {vnDate(a.date)}</b>
        {a.pickup && <div className="text-sm text-ink-500">Đón: {a.pickup.pickedUpByName} lúc {new Date(a.pickup.pickedUpAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}</div>}
        {a.note && <div className="text-sm text-ink-500">{a.note}</div>}</div><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${s[0]}`}>{s[1]}</span></div> }))}
    {tab === "notes" && (notes === null ? <p className="text-ink-500">Đang tải…</p> : notes.length === 0 ? <p className="text-ink-500">Cô giáo chưa ghi nhật ký trong 2 tuần qua</p> :
      notes.map(n => <div key={n.date} className="card space-y-1"><b>{wd(n.date)} {vnDate(n.date)}</b>
        <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-2xl bg-mint-50 p-2"><div className="text-xs text-ink-500">Ăn trưa</div><b>{EAT.find(e => e[0] === n.eating)?.[1] ?? "Chưa ghi"}</b></div>
          <div className="rounded-2xl bg-sky-100 p-2"><div className="text-xs text-ink-500">Ngủ trưa</div><b>{sleepText(n.sleepMinutes) || "Chưa ghi"}</b></div><div className="rounded-2xl bg-sun-100 p-2"><div className="text-xs text-ink-500">Tâm trạng</div><b>{n.mood ?? "Chưa ghi"}</b></div></div>
        {n.note && <p className="whitespace-pre-line">“{n.note}”</p>}</div>))}
  </div>;
}
