"use client";
import { useCallback, useEffect, useState } from "react"; import Link from "next/link"; import { api, http, todayStr } from "@/lib/api"; import { Child } from "@/lib/types";
import { Photo } from "@/components/Photo"; import { InstallHint } from "@/components/InstallHint"; import { EAT, MOODS, sleepText } from "../notes/shared"; import { PickupLine } from "@/components/pickup";
import { parentFeed, PickupRequest } from "@/lib/pickup-api"; import { PickupConfirmCard, useKeptConfirmed } from "@/components/PickupConfirmCard"; import { PushOptIn } from "@/components/pickup-safety"; import { getTodayClosure, TodayClosure, listAbsences, reportAbsence, cancelAbsence, Absence, ABSENCE_REASONS, ABSENCE_ERR, AbsenceReason } from "@/lib/messages-api";
type Att = { status: string | null; note: string | null; pickup: { pickedUpByName: string; pickedUpAt: string } | null };
type Menu = { days: { date: string; meals: Record<string, string | null>; allergyNotes?: Record<string, string | null> }[] };
type Note = { date: string; breakfast?: string | null; eating: string | null; sleepMinutes: number | null; mood: string | null; toilet: string | null; note: string | null }; type Bal = { balance: number; outstanding: unknown[] };
const ST: Record<string, [string, string]> = { present: ["bg-mint-500 text-white", "Bé đã đến lớp"], late: ["bg-sun-500", "Bé đến muộn"], absent: ["bg-rose-500 text-white", "Bé nghỉ hôm nay"] };
const MEAL: Record<string, string> = { breakfast: "Sáng", lunch: "Trưa", snack: "Xế" };
function monday(d = new Date()) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toLocaleDateString("sv-SE") }
export default function Today() {
  const [kids, setKids] = useState<Child[]>([]); const [i, setI] = useState(0); const [att, setAtt] = useState<Att | null>(null);
  const [feed, setFeed] = useState<PickupRequest[]>([]); const [pmsg, setPmsg] = useState(""); const [deep, setDeep] = useState<{ req: string; action: "confirm" | "reject" | null } | null>(null); const [menu, setMenu] = useState<Menu | null>(null); const [bal, setBal] = useState<Bal | null>(null); const [note, setNote] = useState<Note | null>(null); const [unread, setUnread] = useState(0); const d = todayStr();
  const [abs, setAbs] = useState<Absence | null>(null); const [askAbs, setAskAbs] = useState(false); const [absReason, setAbsReason] = useState<AbsenceReason | null>(null); const [absNote, setAbsNote] = useState(""); const [absBusy, setAbsBusy] = useState(false); const [absMsg, setAbsMsg] = useState("");
  useEffect(() => { api.children({ limit: 20 }).then(p => setKids(p.items)); http.get<Menu>(`/menus?week=${monday()}`).then(setMenu).catch(() => {}) }, []);
  // Deep link from the push notification: /today?req=ID&action=confirm|reject (window.location avoids a Suspense boundary for useSearchParams).
  useEffect(() => { const q = new URLSearchParams(window.location.search); const req = q.get("req"); const a = q.get("action");
    if (req) setDeep({ req, action: a === "confirm" || a === "reject" ? a : null }) }, []);
  const { keep, show } = useKeptConfirmed(); const [closure, setClosure] = useState<TodayClosure | null>(null);
  useEffect(() => { const f = () => getTodayClosure().then(setClosure); f(); const t = setInterval(f, 60000); return () => clearInterval(t) }, []);
  const loadFeed = useCallback(() => { parentFeed().then(f => setFeed(f.items)).catch(() => {}) }, []);
  useEffect(() => { loadFeed(); const t = setInterval(loadFeed, 10000); return () => clearInterval(t) }, [loadFeed]);
  useEffect(() => { if (!deep || !feed.length) return; const r = feed.find(x => x.id === deep.req); if (!r) return;
    const j = kids.findIndex(x => x.id === r.childId); if (j >= 0) setI(j);
    document.querySelector(`[data-req="${deep.req}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }) }, [deep, feed, kids]);
  const k = kids[i];
  const load = useCallback(() => { if (!k) return;
    http.get<Att[]>(`/children/${k.id}/attendance?from=${d}&to=${d}`).then(a => setAtt(a[0] ?? null)).catch(() => {});
    http.get<Bal>(`/children/${k.id}/balance`).then(setBal).catch(() => {});
    http.get<{ unreadCount: number }>("/notifications/unread-count").then(r => setUnread(r.unreadCount)).catch(() => {});
    http.get<Note[]>(`/children/${k.id}/daily-notes?from=${d}&to=${d}`).then(n => setNote(n[0] ?? null)).catch(() => {});
    listAbsences(k.id, d, d).then(r => setAbs((Array.isArray(r) ? r : (r as { items: Absence[] }).items ?? []).find(a => a.days.some(x => x.date === d && !x.cancelled)) ?? null)).catch(() => {}) }, [k, d]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load]);
  const pinned = feed.filter(show).sort((a, b) => Number(b.id === deep?.req) - Number(a.id === deep?.req));
  const deepGone = deep && feed.length > 0 && !pinned.some(r => r.id === deep.req) ? feed.find(r => r.id === deep.req) : null;
  if (!k) return <p>Đang tải…</p>;
  const st = ST[att?.status ?? ""] ?? ["border-2 border-dashed border-ink-300 text-ink-500", "Chưa điểm danh"]; const todayMenu = menu?.days.find(x => x.date === d);
  const here = att?.status === "present" || att?.status === "late";
  async function sendAbsence() { if (absBusy) return; setAbsBusy(true); setAbsMsg("");
    try { const r = await reportAbsence(k.id, { from: d, reason: absReason ?? "other", ...(absNote.trim() ? { note: absNote.trim() } : {}) }); setAbs(r); setAskAbs(false); setAbsNote(""); setAbsReason(null); load() }
    catch (x) { const e = x as Error & { errorCode?: string }; if (e.errorCode === "ABSENCE_OVERLAP") { setAskAbs(false); load() } else setAbsMsg(ABSENCE_ERR[e.errorCode ?? ""] ?? e.message) } finally { setAbsBusy(false) } }
  async function undoAbsence() { if (!abs || !confirm("Huỷ báo nghỉ hôm nay?")) return; try { await cancelAbsence(abs.id, [d]); setAbs(null); load() } catch (x) { setAbsMsg(ABSENCE_ERR[(x as Error & { errorCode?: string }).errorCode ?? ""] ?? (x as Error).message) } }
  const debt = bal ? Math.max(0, bal.balance) : 0;
  return <div className="mx-auto max-w-md space-y-4">
    {closure && <section role="alert" data-testid="today-closure" className="rounded-3xl border-l-4 border-rose-500 bg-rose-100 p-4 text-rose-500">
      <b className="block text-lg">⚠ {closure.kind === "emergency" ? "Trường nghỉ đột xuất hôm nay" : `Hôm nay trường nghỉ: ${closure.name}`}</b>
      {closure.reason && <p className="mt-1 text-ink-900">{closure.reason}</p>}
      {here && <p className="mt-2 font-semibold" data-testid="today-closure-pickup">Bé {k.fullName.split(" ").pop()} đang ở trường. Vui lòng đón bé sớm.</p>}</section>}
    {pinned.map(r => <PickupConfirmCard key={r.id} r={r} intent={deep?.req === r.id ? deep.action : null} onDone={(m, ok) => { if (ok) keep(r.id); setPmsg(ok ? "" : m); setDeep(null); loadFeed(); load() }} />)}
    {deepGone && <p className="rounded-2xl bg-ink-100 p-3 text-sm" data-testid="pickup-deep-done">Yêu cầu đón của {deepGone.pickerName} đã được xử lý hoặc hết hạn.</p>}
    {pmsg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="pickup-msg">{pmsg}</p>}
    <InstallHint />
    <PushOptIn />
    {unread > 0 && <Link href="/notifications" data-testid="today-unread" className="card flex min-h-12 items-center justify-between border-l-4 border-rose-500"><span>🔔 Bạn có <b>{unread}</b> thông báo chưa đọc</span><span className="text-mint-700">Xem ›</span></Link>}
    {kids.length > 1 && <div className="flex gap-2">{kids.map((x, j) => <button key={x.id} onClick={() => setI(j)} className={`min-h-12 rounded-xl px-4 ${j === i ? "bg-mint-500 text-white" : "bg-white"}`}>{x.fullName.split(" ").pop()}</button>)}</div>}
    <div className="card flex items-center gap-4 bg-gradient-to-br from-mint-100 to-peach-50"><Photo url={k.photoUrl} id={k.id} withdrawn={k.status === "withdrawn"} size={72} />
      <div><div className="text-sm text-ink-500">Bé hôm nay · {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}</div><h1 className="text-xl font-bold">{k.fullName}</h1><div className="text-sm">{k.className}</div></div></div>
    <Link href={`/today/log/${k.id}?tab=attendance`} className={`block rounded-2xl p-4 text-center text-lg font-semibold ${st[0]}`} data-testid="tile-attendance">{st[1]} <span className="text-sm font-normal opacity-80">›</span></Link>
    {abs || att?.status === "absent" ? <div className="card flex items-center justify-between gap-2 border-l-4 border-sky-500" data-testid="absence-reported"><span>🏠 <b>Đã báo nghỉ hôm nay</b>{abs && <span className="block text-sm text-ink-500">{ABSENCE_REASONS.find(r => r[0] === abs.reason)?.[1]}{abs.note ? ` · ${abs.note}` : ""}</span>}</span>
        {abs?.cancellable?.includes(d) && <button className="min-h-12 shrink-0 px-2 text-sm text-rose-500" onClick={undoAbsence} data-testid="absence-undo">Huỷ</button>}</div>
      : <button className="card flex min-h-14 w-full items-center gap-3 text-left text-[17px] font-semibold" onClick={() => { setAskAbs(true); setAbsMsg("") }} data-testid="btn-absent-today">🏠 Con nghỉ hôm nay</button>}
    {absMsg && !askAbs && <p className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-500" data-testid="absence-msg">{absMsg}</p>}
    {askAbs && <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-900/40 md:items-center" onClick={() => setAskAbs(false)}>
      <div role="dialog" aria-label="Báo nghỉ hôm nay" className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-8 text-[17px] md:rounded-3xl" onClick={e => e.stopPropagation()} data-testid="absence-dialog">
        <b className="block text-lg">Báo bé {k.fullName.split(" ").pop()} nghỉ hôm nay?</b>
        {here && <p className="rounded-xl bg-sun-100 p-2 text-sm" data-testid="absence-here-hint">Hôm nay bé đã đi học rồi. Nếu cần đón bé sớm, hãy nhắn cô ở mục “Nhắn cô”.</p>}
        <div className="text-sm text-ink-500">Lý do (tuỳ chọn)</div>
        <div className="flex flex-wrap gap-2">{ABSENCE_REASONS.map(([r, l]) => <button key={r} type="button" onClick={() => setAbsReason(absReason === r ? null : r)} className={`min-h-12 rounded-xl px-4 ${absReason === r ? "bg-sky-500 text-white" : "bg-ink-100"}`}>{l}</button>)}</div>
        <input className="input" placeholder="Ghi chú cho cô (tuỳ chọn)" value={absNote} onChange={e => setAbsNote(e.target.value)} maxLength={300} />
        {absMsg && <p className="rounded-xl bg-rose-100 p-2 text-sm text-rose-500" data-testid="absence-dialog-msg">{absMsg}</p>}
        <div className="grid grid-cols-2 gap-2"><button className="min-h-12 rounded-xl bg-ink-100 font-semibold" onClick={() => setAskAbs(false)}>Thôi</button>
          <button className="min-h-12 rounded-xl bg-sky-500 font-semibold text-white disabled:opacity-60" disabled={absBusy} onClick={sendAbsence} data-testid="absence-confirm">{absBusy ? "Đang gửi…" : "Xác nhận báo nghỉ"}</button></div></div></div>}
    <PickupLine pickup={att?.pickup} reqs={feed.filter(r => r.childId === k.id)} card />
    <Link href="/messages" className="card flex min-h-12 items-center justify-between" data-testid="link-messages"><span>💬 Nhắn cô: báo nghỉ, dặn thuốc, đón muộn</span><span className="text-mint-700">›</span></Link>
    <Link href="/pickups/delegates" className="card flex min-h-12 items-center justify-between" data-testid="link-delegates"><span>🛡️ Người được đón bé</span><span className="text-mint-700">Quản lý ›</span></Link>
    {todayMenu && <Link href="/menu" className="card block" data-testid="tile-menu"><h2 className="mb-2 flex justify-between font-semibold">🍚 Thực đơn hôm nay<span className="text-mint-700">›</span></h2>{Object.entries(todayMenu.meals).filter(([, v]) => v).map(([m, v]) => <div key={m} className="flex gap-3 border-t border-ink-100 py-2 text-sm"><span className="w-10 text-ink-500">{MEAL[m] ?? m}</span><span>{v}{k.allergies && todayMenu.allergyNotes?.[m] && <span className="mt-1 block rounded-xl bg-rose-100 px-2 py-1 text-xs text-rose-500">🔄 {todayMenu.allergyNotes[m]}</span>}</span></div>)}
      {k.allergies && <p className="mt-1 text-xs text-rose-500">Bé dị ứng {k.allergies}, nhà trường sẽ thay món phù hợp.</p>}</Link>}
    <Link href={`/today/log/${k.id}?tab=notes`} className="card block" data-testid="today-notes"><h2 className="mb-2 flex justify-between font-semibold">📝 Nhật ký của bé hôm nay<span className="text-mint-700">›</span></h2>{!note ? <p className="text-sm text-ink-500">Cô giáo chưa ghi nhật ký hôm nay</p> : <div className="grid grid-cols-3 gap-2 text-center text-sm">
      <div className="rounded-2xl bg-mint-50 p-2"><div className="text-xs text-ink-500">Ăn trưa</div><b>{EAT.find(e => e[0] === note.eating)?.[1] ?? "Chưa ghi"}</b></div><div className="rounded-2xl bg-sky-100 p-2"><div className="text-xs text-ink-500">Ngủ trưa</div><b>{sleepText(note.sleepMinutes) || "Chưa ghi"}</b></div>
      <div className="rounded-2xl bg-sun-100 p-2"><div className="text-xs text-ink-500">Tâm trạng</div><b>{MOODS.find(m => m[0] === note.mood)?.[1] ?? ""} {note.mood ?? "Chưa ghi"}</b></div>{(note.breakfast || note.toilet) && <p className="col-span-3 text-left text-xs text-ink-500" data-testid="today-notes-extra">{note.breakfast && <>🥣 Ăn sáng: {EAT.find(e => e[0] === note.breakfast)?.[1] ?? note.breakfast}  </>}{note.toilet && <>🚽 {note.toilet}</>}</p>}
      {note.note && <p className="col-span-3 whitespace-pre-line text-left">“{note.note}”</p>}</div>}</Link>
    {bal && <Link href={`/fees/child/${k.id}`} className="card flex min-h-14 items-center justify-between" data-testid="tile-fees"><span>💰 Học phí</span>
      {debt > 0 ? <b className="text-rose-500" data-testid="fee-debt">Còn nợ {debt.toLocaleString("vi-VN")}đ ›</b> : <b className="text-mint-700" data-testid="fee-paid">Đã đóng đủ ›</b>}</Link>}
    <div className="grid grid-cols-2 gap-2"><Link href={`/health/${k.id}`} className="btn block !bg-sky-500 text-center" data-testid="link-health">📏 Tăng trưởng</Link><Link href={`/children/${k.id}`} className="btn block text-center">Hồ sơ của bé</Link></div></div>;
}
