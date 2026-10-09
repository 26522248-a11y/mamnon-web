"use client";
import { useCallback, useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
import { api, http, todayStr } from "@/lib/api"; import { Child } from "@/lib/types"; import { Photo, WithdrawnBadge } from "@/components/Photo"; import { PickupLine, PickupReq } from "@/components/pickup"; import { unlinkGuardian } from "@/lib/guardian-api"; import { parentFeed, PickupRequest } from "@/lib/pickup-api"; import { PickupConfirmCard, useKeptConfirmed } from "@/components/PickupConfirmCard"; import { PhotoConsentToggle } from "@/components/PhotoConsentToggle"; import { fmtDate } from "@/lib/date";
type Guardian = { id: string; fullName: string; relation: string; phone: string; canPickup: boolean };
type Att = { id: string; date: string; status: string | null; note: string | null; pickup: { pickedUpByName: string; relation?: string; pickedUpAt: string } | null };
type Growth = { id: string; date: string; heightCm: number; weightKg: number; bmi: number };
type Hist = { changedAt?: string; createdAt?: string; changedByName?: string; oldStatus?: string; newStatus?: string; [k: string]: unknown };
const ST: Record<string, string> = { present: "Có mặt", absent: "Vắng", late: "Đi muộn" };
export default function ChildDetail() {
  const { id } = useParams<{ id: string }>(); const me = api.me()!; const staff = me.role === "admin" || me.role === "teacher";
  const [c, setC] = useState<Child & { address?: string; healthNotes?: string } | null>(null); const [gs, setGs] = useState<Guardian[]>([]);
  const [att, setAtt] = useState<Att | null>(null); const [reqs, setReqs] = useState<PickupReq[]>([]); const [growth, setGrowth] = useState<Growth[]>([]);
  const [feed, setFeed] = useState<PickupRequest[]>([]); const { keep, show } = useKeptConfirmed(); const [pmsg, setPmsg] = useState("");
  const [hist, setHist] = useState<Hist[]>([]); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const load = useCallback(async () => { const d = todayStr();
    http.get<typeof c>(`/children/${id}`).then(setC).catch(e => setErr(e.message));
    http.get<Guardian[]>(`/children/${id}/guardians`).then(setGs).catch(() => {});
    if (me.role !== "accountant") http.get<Growth[]>(`/children/${id}/growth`).then(setGrowth).catch(() => {});
    if (me.role === "accountant") return;
    const a = (await http.get<Att[]>(`/children/${id}/attendance?from=${d}&to=${d}`).catch(() => []))[0] ?? null; setAtt(a);
    if (me.role === "parent") parentFeed(id).then(f => setFeed(f.items)).catch(() => {}); // carries parent/school steps + needsMyAction
    else http.get<PickupReq[]>(`/pickup-requests?childId=${id}&date=${d}`).then(setReqs).catch(() => {});
    if (a && staff) http.get<Hist[]>(`/attendance/${a.id}/history`).then(setHist).catch(() => {}); }, [id, me.role, staff]);
  useEffect(() => { load() }, [load]);
  if (err) return <p className="text-rose-500">{err}</p>; if (!c) return <p>Đang tải…</p>;
  const lineReqs = me.role === "parent" ? feed.filter(r => r.childId === id) : reqs; const pinned = lineReqs.filter(r => me.role === "parent" && show(r as PickupRequest)) as PickupRequest[];
  const picked = !!att?.pickup;
  return <div className="mx-auto max-w-4xl space-y-4">
    <Link href="/children" className="text-sm text-mint-700">‹ Hồ sơ trẻ</Link>
    <div className="card flex items-center gap-4"><Photo url={c.photoUrl} id={c.id} withdrawn={c.status === "withdrawn"} size={80} noConsent={c.photoConsent === false} />
      <div><h1 className="text-2xl font-bold">{c.fullName} {c.status === "withdrawn" && <WithdrawnBadge className="align-middle" />}</h1><div className="text-ink-500">{c.className} · Sinh {fmtDate(c.dob)} · {c.gender === "F" ? "Nữ" : "Nam"}</div>
        {c.allergies && <span className="mt-1 inline-block rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-500">⚠ Dị ứng: {c.allergies}</span>}</div></div>
    <PhotoConsentToggle childId={c.id} canEdit={me.role === "admin" || me.role === "parent"} />
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card space-y-3"><h2 className="text-lg font-semibold">Hôm nay</h2>
        {!att ? <p className="text-ink-500">Chưa điểm danh</p> : <p>Trạng thái: <b>{ST[att.status ?? ""] ?? "Chưa điểm"}</b></p>}
        {pinned.map(r => <PickupConfirmCard key={r.id} r={r} onDone={(m, ok) => { if (ok) keep(r.id); setPmsg(ok ? "" : m); load() }} />)}
        {pmsg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="pickup-msg">{pmsg}</p>}
        {att && <PickupLine pickup={att.pickup} reqs={lineReqs} />}
        {staff && att?.id && (att.status === "present" || att.status === "late") && <Link href={`/pickups/handover/${att.id}`} className="btn block min-h-12 text-center" data-testid="link-handover">{picked ? "Xem giao bé" : "🚸 Giao bé ›"}</Link>}
        {msg && <p className="text-sm">{msg}</p>}</section>
      <section className="card space-y-2"><h2 className="text-lg font-semibold">Người giám hộ</h2>
        {gs.map(g => <div key={g.id} className={`rounded-2xl p-3 ${g.canPickup ? "bg-mint-50" : "bg-rose-100"}`}><b>{g.fullName}</b> ({g.relation}) · <a href={`tel:${g.phone}`} className="underline">{g.phone}</a>{!g.canPickup && <div className="text-sm text-rose-500">⛔ Không được đón bé</div>}
          {me.role === "admin" && <UnlinkGuardian childId={c.id} childName={c.fullName} g={g} onDone={m => { setMsg(m); load() }} />}</div>)}
        {c.address && <p className="text-sm text-ink-500">Địa chỉ: {c.address}</p>}</section>
      {growth.length > 0 && <section className="card"><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Chiều cao, cân nặng</h2><Link href={`/health/${c.id}`} className="text-sm text-mint-700 underline" data-testid="link-growth-chart">Biểu đồ ›</Link></div><table className="w-full text-sm"><thead className="text-ink-500"><tr><th className="text-left">Ngày</th><th>Cao (cm)</th><th>Nặng (kg)</th><th>BMI</th></tr></thead>
        <tbody>{growth.map(g => <tr key={g.id} className="border-t border-ink-100 text-center"><td className="py-2 text-left">{fmtDate(g.date)}</td><td>{g.heightCm}</td><td>{g.weightKg}</td><td>{g.bmi}</td></tr>)}</tbody></table></section>}
      {staff && hist.length > 0 && <section className="card"><h2 className="mb-2 text-lg font-semibold">Lịch sử sửa điểm danh</h2>
        {hist.map((h, i) => <div key={i} className="border-t border-ink-100 py-2 text-sm">{JSON.stringify(h).slice(0, 0)}{String(h.changedByName ?? h.changedBy ?? "")} · {new Date(String(h.changedAt ?? h.createdAt)).toLocaleString("vi-VN")} · {ST[String(h.oldStatus)] ?? "Chưa điểm"} → {ST[String(h.newStatus)] ?? ""}</div>)}</section>}
    </div></div>;
}

/** Admin only: danger "Gỡ liên kết" with mandatory reason + confirm dialog; backend keeps history. */
function UnlinkGuardian({ childId, childName, g, onDone }: { childId: string; childName: string; g: Guardian; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const go = async () => { if (!reason.trim()) return setErr("Bắt buộc ghi lý do gỡ liên kết");
    if (!confirm(`Gỡ ${g.fullName} (${g.relation}) khỏi bé ${childName}?\nNgười này sẽ không còn xem được thông tin của bé và không được đón bé. Thao tác được lưu lịch sử.`)) return;
    setBusy(true); setErr(""); try { await unlinkGuardian(childId, g.id, reason.trim()); setOpen(false); onDone(`Đã gỡ liên kết ${g.fullName}`) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  if (!open) return <button className="mt-1 min-h-12 text-sm font-semibold text-rose-500 underline" onClick={() => setOpen(true)} data-testid="guardian-unlink">Gỡ liên kết</button>;
  return <div className="mt-2 space-y-2 rounded-xl border-2 border-rose-500 bg-white p-2" data-testid="guardian-unlink-form">
    <textarea className="input min-h-16" placeholder="Lý do gỡ liên kết (bắt buộc)" value={reason} maxLength={500} onChange={e => { setReason(e.target.value); setErr("") }} data-testid="guardian-unlink-reason" />
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <div className="flex gap-2"><button className="btn min-h-12 flex-1 !bg-rose-500 disabled:!bg-ink-100" disabled={busy} onClick={go} data-testid="guardian-unlink-submit">Gỡ liên kết</button>
      <button className="btn min-h-12 flex-1 !bg-ink-300" onClick={() => setOpen(false)}>Hủy</button></div></div>;
}
