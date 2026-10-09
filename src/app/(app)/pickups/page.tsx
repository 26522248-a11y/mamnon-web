"use client";
/** /pickups by role: parent → requests + link to delegates; admin / duty → approval board (+ admin: delegate queue, duty planner); teacher → handover list. */
import { useCallback, useEffect, useState } from "react"; import Link from "next/link";
import { api, http, todayStr } from "@/lib/api";
import { listRequests, myDuty, MyDuty, PickupRequest } from "@/lib/pickup-api";
import { hhmm } from "@/components/pickup-safety";
import { Board } from "./Board"; import { DelegateQueue } from "./DelegateQueue"; import { DutyPlanner } from "./DutyPlanner";

const CHIP: Record<string, [string, string]> = { pending: ["bg-sun-100", "⏳ Chờ xác nhận"], approved: ["bg-mint-100 text-mint-700", "✓ Đã đủ xác nhận"], rejected: ["bg-rose-100 text-rose-500", "⛔ Không được đón"], expired: ["bg-ink-100 text-ink-500", "Hết hạn"] };
export default function Pickups() {
  const me = api.me()!; const [duty, setDuty] = useState<MyDuty | null>(null);
  useEffect(() => { if (me.role !== "parent") myDuty().then(setDuty) }, [me.role]);
  if (me.role === "parent") return <ParentView />;
  const canApprove = me.role === "admin" || !!duty?.canApproveToday;
  return <div className="mx-auto max-w-4xl space-y-4"><h1 className="text-2xl font-bold">Đón bé</h1>
    {me.role !== "admin" && duty?.onDutyToday && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="on-duty">🛡️ Hôm nay bạn trực đón: được duyệt phần nhà trường. Yêu cầu bạn đã duyệt phải do người khác giao bé.</p>}
    {me.role === "accountant" && !duty?.onDutyToday && <p className="text-ink-500">Hôm nay bạn không trực đón.</p>}
    {canApprove && <Board isAdmin={me.role === "admin"} />}
    {me.role === "admin" && <DelegateQueue />}
    {me.role === "teacher" && <TeacherList classIds={me.classIds} />}
    {me.role === "admin" && <DutyPlanner />}
    {duty && duty.upcoming.length > 0 && me.role !== "admin" && <p className="text-sm text-ink-500">Lịch trực sắp tới: {duty.upcoming.map(d => new Date(d.date + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" })).join(", ")}</p>}
  </div>;
}

type Row = { attendanceId: string | null; childId: string; fullName: string; status: string | null; pickup: { pickedUpByName: string; pickedUpAt: string } | null; pendingPickupRequests?: number };
function TeacherList({ classIds }: { classIds: string[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => Promise.all(classIds.map(c => http.get<{ items: Row[] }>(`/classes/${c}/attendance?date=${todayStr()}`).then(r => r.items).catch(() => [] as Row[])))
    .then(a => setRows(a.flat())), [classIds]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load]);
  const here = rows?.filter(r => r.attendanceId && (r.status === "present" || r.status === "late")) ?? [];
  return <section className="card space-y-2" data-testid="teacher-handover-list"><h2 className="text-lg font-bold">Giao bé hôm nay</h2>
    {rows && !here.length && <p className="text-sm text-ink-500">Chưa có bé nào có mặt.</p>}
    {here.sort((a, b) => Number(!!a.pickup) - Number(!!b.pickup) || (b.pendingPickupRequests ?? 0) - (a.pendingPickupRequests ?? 0)).map(r =>
      <Link key={r.childId} href={`/pickups/handover/${r.attendanceId}`} data-testid="handover-link" className={`flex min-h-14 items-center justify-between rounded-2xl px-4 py-2 ${r.pickup ? "bg-mint-50" : r.pendingPickupRequests ? "bg-sun-100" : "bg-white border border-ink-100"}`}>
        <span><b>{r.fullName}</b>{r.pickup && <span className="block text-xs text-mint-700">🏠 {r.pickup.pickedUpByName} đón {hhmm(r.pickup.pickedUpAt)}</span>}
          {!r.pickup && !!r.pendingPickupRequests && <span className="block text-xs">⏳ Có người ngoài danh sách chờ xác nhận</span>}</span>
        <span className="text-sm text-mint-700">{r.pickup ? "Xem" : "Giao bé ›"}</span></Link>)}</section>;
}

function ParentView() {
  const [rs, setRs] = useState<PickupRequest[] | null>(null);
  useEffect(() => { listRequests({ date: todayStr() }).then(setRs).catch(() => setRs([])) }, []);
  return <div className="mx-auto max-w-md space-y-4"><h1 className="text-2xl font-bold">Đón bé</h1>
    <Link href="/pickups/delegates" className="card flex min-h-14 items-center justify-between" data-testid="link-delegates"><span>🛡️ <b>Người được đón bé</b><span className="block text-sm text-ink-500">Thêm người đón hộ (tên và số điện thoại)</span></span><span className="text-mint-700">›</span></Link>
    {rs?.some(r => r.needsMyAction) && <Link href="/today" className="block rounded-2xl bg-rose-500 p-4 font-semibold text-white">⚠ Có người đang chờ bạn xác nhận đón bé ›</Link>}
    <h2 className="font-semibold">Yêu cầu đón hôm nay</h2>
    {rs?.length === 0 && <p className="text-ink-500">Hôm nay không có ai ngoài danh sách xin đón bé.</p>}
    {rs?.map(r => { const [c, l] = CHIP[r.status] ?? CHIP.expired; return <div key={r.id} className="card flex items-center justify-between gap-2" data-testid="parent-request">
      <span><b>{r.pickerName}</b>{r.relation && ` (${r.relation})`}<span className="block text-sm text-ink-500">đón bé {r.childName} · {hhmm(r.createdAt)}</span></span>
      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${c}`}>{l}</span></div> })}</div>;
}
