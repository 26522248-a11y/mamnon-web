"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import { api, http, todayStr } from "@/lib/api"; import { MedicineDue } from "@/lib/messages-api";
type ClassRow = { classId: string; className: string; totalChildren: number; present: number; late: number; absent: number; unmarked: number };
type Kid = { childId?: string; id?: string; fullName: string; className?: string | null; allergies?: string | null };
type Pick = { id: string; childName: string; pickerName: string; relation?: string | null; status: string; classId?: string };
type Summary = { totalChildren: number; present: number; late: number; absent: number; unmarked: number; byClass?: ClassRow[];
  // Trường mới backend đang thêm — đọc mềm, chưa có thì tự suy ra
  attention?: Record<string, unknown>; unmarkedClasses?: unknown; allergicPresent?: unknown; allergicChildrenPresent?: unknown; pendingPickups?: unknown; pendingPickupRequests?: unknown };
type Attention = { unmarked: ClassRow[]; allergic: Kid[]; pickups: Pick[]; pickupCount: number; meds: MedicineDue[] };
const arr = <T,>(v: unknown): T[] | null => Array.isArray(v) ? v as T[] : null;

export default function Dashboard() {
  const me = api.me(); const admin = me?.role === "admin"; const [total, setTotal] = useState<number | null>(null); const [cls, setCls] = useState<number | null>(null);
  const [s, setS] = useState<Summary | null>(null); const [att, setAtt] = useState<Attention | null>(null);
  useEffect(() => { const d = todayStr();
    api.children({ limit: 1 }).then(p => setTotal(p.total)).catch(() => {}); api.classes().then(c => setCls(c.length)).catch(() => {});
    if (!admin) return;
    (async () => { const r = await http.get<Summary>(`/dashboard/summary?date=${d}`); setS(r); const a = r.attention ?? {};
      const by = r.byClass ?? [];
      // 1) Lớp chưa điểm danh
      const notMarked = arr<{ classId: string; className: string; totalChildren?: number }>(a.classesNotMarked);
      const partly = arr<{ classId: string; className: string; totalChildren?: number; unmarked?: number }>(a.classesPartlyMarked);
      const unmarkedApi = arr<{ classId: string; className: string; unmarked?: number }>(a.unmarkedClasses ?? r.unmarkedClasses)
        ?? (notMarked || partly ? [...(notMarked ?? []).map(c => ({ ...c, unmarked: c.totalChildren })), ...(partly ?? [])] : null);
      const unmarked = unmarkedApi ? unmarkedApi.map(u => ({ ...(by.find(b => b.classId === u.classId) ?? { totalChildren: 0, present: 0, late: 0, absent: 0, unmarked: 0 }), ...u }) as ClassRow) : by.filter(b => b.unmarked > 0);
      // 2) Yêu cầu đón đang chờ
      const pApi = a.pendingPickups ?? a.pendingPickupRequests ?? r.pendingPickups ?? r.pendingPickupRequests;
      let pickups = arr<Pick>(pApi); let pickupCount = typeof pApi === "number" ? pApi : pickups?.length ?? 0;
      if (!pickups) { pickups = (await http.get<Pick[]>(`/pickup-requests?status=pending&date=${d}`).catch(() => [] as Pick[])).filter(p => p.status === "pending"); if (typeof pApi !== "number") pickupCount = pickups.length }
      // 3) Bé dị ứng có mặt hôm nay
      let allergic = arr<Kid>(a.allergyChildrenPresent ?? a.allergicPresent ?? a.allergicChildrenPresent ?? r.allergicPresent ?? r.allergicChildrenPresent);
      if (!allergic) { allergic = [];
        const m = await http.get<{ allergyAlerts: (Kid & { childId: string })[] }>(`/menus?week=${d}`).catch(() => null);
        const kids = m?.allergyAlerts ?? []; const classIds = Array.from(new Set(kids.map(k => by.find(b => b.className === k.className)?.classId).filter(Boolean))) as string[];
        const rows = (await Promise.all(classIds.map(id => http.get<{ items: { childId: string; status: string | null }[] }>(`/classes/${id}/attendance?date=${d}`).catch(() => ({ items: [] }))))).flatMap(x => x.items);
        allergic = kids.filter(k => rows.some(x => x.childId === k.childId && (x.status === "present" || x.status === "late"))) }
      // 4) Thuốc chưa cho uống (round2 §8: attention.medicinesNotGiven, quá giờ + medicineLateMinutes); absent field → no row
      const meds = arr<MedicineDue>(a.medicinesNotGiven) ?? [];
      setAtt({ unmarked, allergic, pickups, pickupCount, meds }) })().catch(() => {});
  }, [admin]);
  const here = s ? s.present + s.late : null;
  const stats = [{ l: "Tổng số trẻ", v: total ?? "Đang tải…", c: "bg-mint-100" }, { l: "Số lớp", v: cls ?? "Đang tải…", c: "bg-peach-100" },
    ...(admin ? [{ l: "Có mặt hôm nay", v: s ? `${here}/${s.totalChildren}` : "Đang tải…", c: "bg-sky-100" }] : [])];
  const nAttn = att ? att.unmarked.length + att.allergic.length + att.pickupCount + att.meds.length : 0;
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Tổng quan</h1>
    <div className="grid gap-4 sm:grid-cols-3">{stats.map(x => <div key={x.l} className={`card ${x.c}`}><div className="text-sm text-ink-700">{x.l}</div><div className={typeof x.v === "string" && x.v.startsWith("Đang") ? "py-2 text-base text-ink-500" : "text-3xl font-bold"}>{x.v}</div></div>)}</div>
    {admin && <div className="grid gap-4 lg:grid-cols-5">
      <section className="card lg:col-span-3" data-testid="dash-by-class"><h2 className="mb-3 text-lg font-semibold">Điểm danh theo lớp hôm nay</h2>
        {!s ? <p className="text-sm text-ink-500">Đang tải…</p> : !s.byClass?.length && <p className="text-sm text-ink-500">Chưa có dữ liệu</p>}
        <div className="space-y-3">{s?.byClass?.map(b => { const t = Math.max(b.totalChildren, 1), p = (b.present / t) * 100, l = (b.late / t) * 100, a = (b.absent / t) * 100;
          return <div key={b.classId} data-testid="dash-class-bar"><div className="mb-1 flex justify-between text-sm"><b>{b.className}</b><span className="text-ink-500">{b.present + b.late}/{b.totalChildren} có mặt{b.unmarked ? ` · ${b.unmarked} chưa điểm` : ""}</span></div>
            <div className="flex h-4 overflow-hidden rounded-full bg-ink-100" title={`Có mặt ${b.present}, muộn ${b.late}, vắng ${b.absent}, chưa điểm ${b.unmarked}`}>
              <div className="bg-mint-500" style={{ width: p + "%" }} /><div className="bg-sun-500" style={{ width: l + "%" }} /><div className="bg-rose-500" style={{ width: a + "%" }} /></div></div> })}</div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-mint-500" />Có mặt</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sun-500" />Đi muộn</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Vắng</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-ink-100 ring-1 ring-ink-300" />Chưa điểm</span></div></section>
      <section className="card space-y-3 lg:col-span-2" data-testid="dash-attention"><h2 className="text-lg font-semibold">Cần chú ý {att && nAttn > 0 && <span className="ml-1 rounded-full bg-peach-500 px-2 text-sm text-white">{nAttn}</span>}</h2>
        {!att ? <p className="text-sm text-ink-500">Đang tải…</p> : nAttn === 0 ? <p className="text-sm text-mint-700">Mọi thứ ổn ✔</p> : <>
          {att.pickupCount > 0 && <Row href="/pickups" tone="rose" testid="attn-pickups" title={`🚸 ${att.pickupCount} yêu cầu đón chờ duyệt`} action="Duyệt">
            {att.pickups.slice(0, 3).map(p => <div key={p.id}>{p.childName}: {p.pickerName}{p.relation ? ` (${p.relation})` : ""}</div>)}</Row>}
          {att.meds.length > 0 && <Row href={`/attendance${att.meds[0]?.classId ? `?class=${att.meds[0].classId}` : ""}`} tone="peach" testid="attn-medicines" title={`💊 ${new Set(att.meds.map(m => m.childId)).size} bé có thuốc chưa cho uống`} action="Xem" />}
          {att.meds.length > 1 && <div className="-mt-2 space-y-1 pl-3">{att.meds.map((m, i) => <Link key={m.doseId ?? i} href={`/attendance?class=${m.classId}`} className="block min-h-12 rounded-xl px-3 py-3 text-sm hover:bg-peach-50" data-testid="attn-medicine-row">{m.fullName}{m.className ? ` (${m.className})` : ""}: {m.medicineName} lúc {m.time}{m.minutesLate ? <span className="text-rose-500"> · trễ {m.minutesLate} phút</span> : null} ›</Link>)}</div>}
          {att.unmarked.map(u => <Row key={u.classId} href={`/attendance?class=${u.classId}`} tone="sun" testid="attn-unmarked" title={`📋 Lớp ${u.className} chưa điểm danh`} action="Mở lớp">
            <div>{u.unmarked}{u.totalChildren ? `/${u.totalChildren}` : ""} bé chưa điểm</div></Row>)}
          {att.allergic.map(k => <Row key={k.childId ?? k.id ?? k.fullName} href={k.childId ?? k.id ? `/children/${k.childId ?? k.id}` : "/menu"} tone="peach" testid="attn-allergic" title={`⚠ ${k.fullName}${k.className ? ` (${k.className})` : ""} dị ứng ${k.allergies ?? ""}`} action="Xem" />)}</>}</section></div>}
  </div>;
}

const TONE: Record<string, string> = { rose: "bg-rose-100 text-rose-500", sun: "bg-sun-100 text-peach-600", peach: "bg-peach-100 text-peach-600" };
/** Whole row is the touch target; the arrow names the action and goes straight to the handling screen. */
function Row({ href, tone, title, action, testid, children }: { href: string; tone: string; title: string; action: string; testid: string; children?: React.ReactNode }) {
  return <Link href={href} data-testid={testid} className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${TONE[tone]}`}>
    <span className="text-ink-900"><b>{title}</b>{children && <span className="block text-ink-700">{children}</span>}</span><span className="shrink-0 font-semibold">{action} →</span></Link>;
}
