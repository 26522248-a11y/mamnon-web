"use client";
/** G5 (mockups12): trang đầu giáo viên – Vào ca/Ra ca ngay khi mở app, điểm danh lớp, dặn thuốc hôm nay, đơn nghỉ. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, http } from "@/lib/api";
import { checkIn, checkOut, getMyToday, MyToday, shiftLabel } from "@/lib/staff-api";
import { classMessages, msgFeatures, vnToday } from "@/lib/messages-api";
import { Leave, leaveWhen, myLeaves, STATUS_UI, TYPE_UI } from "@/lib/leave-api";
import SubstituteToday from "@/components/SubstituteToday";

const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const errMsg = (e: unknown) => (e as Error)?.message || "Có lỗi, vui lòng thử lại";

export default function TeacherHome() {
  const me = api.me();
  const [m, setM] = useState<MyToday | null>(null); const [now, setNow] = useState(""); const [busy, setBusy] = useState(false); const [lock, setLock] = useState(false); const [err, setErr] = useState("");
  const [att, setAtt] = useState<{ done: number; total: number } | null>(null); const [meds, setMeds] = useState<number | null>(null); const [lv, setLv] = useState<Leave | null>(null);
  const today = vnToday(); const classId = me?.classIds?.[0];
  useEffect(() => {
    getMyToday().then(setM).catch(e => setErr(errMsg(e)));
    myLeaves().then(ls => setLv(ls.filter(l => l.toDate >= today && l.status !== "cancelled").pop() ?? null)).catch(() => {});
    const t = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })); t(); const id = setInterval(t, 15000);
    if (classId) {
      http.get<{ items: { status?: string | null }[] }>(`/classes/${classId}/attendance?date=${today}`).then(s => setAtt({ done: s.items.filter(i => i.status).length, total: s.items.length })).catch(() => setAtt(null));
      msgFeatures().then(ft => ft.classMessages ? classMessages(classId, today) : null).then(r => setMeds(r ? r.medicines.length : 0)).catch(() => setMeds(null));
    }
    return () => clearInterval(id);
  }, [classId, today]);
  if (me?.role !== "teacher") return <p className="text-ink-500">Trang này dành cho giáo viên.</p>;
  const punch = async (out: boolean) => { if (out && !window.confirm("Ra ca bây giờ?")) return; setBusy(true); setErr(""); try { setM(await (out ? checkOut() : checkIn())); if (!out) { setLock(true); setTimeout(() => setLock(false), 60000) } } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) } };
  const inShift = !!m?.checkIn && !m?.checkOut; const d = new Date(today + "T00:00:00");
  return <div className="mx-auto max-w-md space-y-3" data-testid="teacher-home">
    <div className="-mx-4 -mt-4 rounded-b-3xl bg-mint-500 p-4 text-white md:mx-0 md:mt-0 md:rounded-3xl">
      <p className="text-xs">{WD[d.getDay()]}, {today.slice(8)}/{today.slice(5, 7)}{m && ` · ${shiftLabel(m.shift)}${m.start ? ` ${m.start}–${m.end}` : ""}`}</p>
      <h1 className="text-xl font-bold">Chào {me.name} 👋</h1></div>
    <div className="card flex items-center justify-between gap-3 !p-4" data-testid="home-punch">
      <div><p className="text-xs text-ink-500">{!m ? "Đang tải…" : m.checkOut ? `Vào ${m.checkIn} · Ra ${m.checkOut}` : m.checkIn ? `Vào ca lúc ${m.checkIn}` : "Chưa vào ca"}</p><p className="text-3xl font-bold tabular-nums">{now}</p></div>
      {m?.checkOut ? <span className="rounded-xl bg-mint-50 px-3 py-2 text-sm font-semibold text-mint-700">✓ Đã ra ca</span>
        : <button className={inShift ? "min-h-14 shrink-0 rounded-2xl border-2 border-peach-500 bg-white px-5 font-semibold text-peach-600 disabled:opacity-50" : "btn !min-h-14 shrink-0 px-5"} disabled={busy || !m || (inShift && lock)} onClick={() => punch(inShift)} data-testid="btn-checkin">{inShift ? (lock ? "✓ Đã vào ca" : "Ra ca") : "✓ Vào ca"}</button>}</div>
    {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
    <SubstituteToday />
    {lv && <Link href={`/staff/leaves/${lv.id}`} className={`block rounded-2xl border border-l-4 p-3 text-sm ${STATUS_UI[lv.status].cls}`} data-testid="home-leave">
      <p className="font-semibold">{TYPE_UI[lv.type]?.icon} Đơn nghỉ {TYPE_UI[lv.type]?.label.toLowerCase()} · {leaveWhen(lv)}</p>
      <p>{STATUS_UI[lv.status].label}{lv.status === "approved" && lv.substitutions.length ? ` · Cô trông thay: ${Array.from(new Set(lv.substitutions.map(x => x.substituteTeacher?.name).filter(Boolean))).join(", ")}` : ""}{lv.status === "rejected" && lv.decisionNote ? ` · ${lv.decisionNote}` : ""}</p></Link>}
    <div className="grid grid-cols-2 gap-2">
      <Link href="/attendance" className="card !p-3" data-testid="home-att"><p className="text-xs text-ink-500">Điểm danh lớp</p><b className="text-lg">{att === null ? "Đang tải…" : att.done === 0 ? "Chưa điểm" : `${att.done}/${att.total} bé`}</b></Link>
      <Link href="/attendance" className="card !p-3" data-testid="home-meds"><p className="text-xs text-ink-500">Dặn thuốc hôm nay</p><b className={`text-lg ${meds ? "text-peach-600" : ""}`}>{meds === null ? "Đang tải…" : meds ? `💊 ${meds} bé` : "Không có"}</b></Link></div>
    <div className="grid grid-cols-2 gap-2">
      <Link href="/notes" className="card flex min-h-14 items-center !p-3 font-semibold">📝 Nhật ký</Link>
      <Link href="/pickups" className="card flex min-h-14 items-center !p-3 font-semibold">🚸 Giao bé</Link></div>
    <div className="grid grid-cols-2 gap-2"><Link href="/staff/leaves/new" className="flex min-h-12 items-center justify-center rounded-xl border border-ink-100 bg-white font-semibold" data-testid="home-leave-btn">🏖 Xin nghỉ</Link>
      <Link href="/staff" className="flex min-h-12 items-center justify-center rounded-xl border border-ink-100 bg-white font-semibold">Xem công tuần</Link></div>
  </div>;
}
