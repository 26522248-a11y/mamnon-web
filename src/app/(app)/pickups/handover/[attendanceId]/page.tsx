"use client";
/**
 * Screen 3 – Teacher handover. Listed parents / school-approved delegates: check photo + CCCD, hand over directly.
 * Off-list people (incl. delegates not yet approved): two ticks (phụ huynh, nhà trường); "Giao bé" stays locked until both.
 * No approve controls here: teachers can't approve, and the school approver may not hand over (YOU_APPROVED).
 */
import { useCallback, useEffect, useState } from "react"; import Link from "next/link"; import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { BLOCKER_TEXT, createRequest, handOver, idFirstLast, idLast4, Identity, IdentityKind, MultiWarning, isAllowedPhoto, isHeic, PHOTO_ACCEPT, PHOTO_MAX_BYTES, PickupOptions, pickupErrorText, pickupIdentity, pickupOptions, PickupRequest, shrinkImage } from "@/lib/pickup-api";
import { hhmm, PersonPhoto, PreviewImg, StepTick } from "@/components/pickup-safety";
import { CallPanel } from "../../CallPanel";

type Sel = { kind: IdentityKind; id: string };
const REQ_CHIP: Record<string, [string, string]> = { pending: ["bg-sun-100", "⏳ Chờ xác nhận"], approved: ["bg-mint-100 text-mint-700", "✓ Đủ 2 xác nhận"], rejected: ["bg-rose-100 text-rose-500", "⛔ Từ chối"], expired: ["bg-ink-100 text-ink-500", "Hết hạn"] };

export default function Handover() {
  const { attendanceId } = useParams<{ attendanceId: string }>(); const me = api.me()!;
  const [o, setO] = useState<PickupOptions | null>(null); const [err, setErr] = useState(""); const [sel, setSel] = useState<Sel | null>(null);
  const [form, setForm] = useState<null | { pickerName?: string; pickerPhone?: string; relation?: string }>(null); const [done, setDone] = useState<{ text: string; warnings: MultiWarning[] } | null>(null);
  const load = useCallback(() => pickupOptions(attendanceId).then(setO).catch(e => setErr(e.message)), [attendanceId]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load]);
  if (me.role !== "admin" && me.role !== "teacher") return <p className="text-ink-500">Chỉ giáo viên / Ban giám hiệu giao bé.</p>;
  if (err) return <p className="text-rose-500">{err}</p>; if (!o) return <p>Đang tải…</p>;
  const back = <button className="min-h-12 text-sm text-mint-700" onClick={() => { setSel(null); setForm(null) }}>‹ Danh sách người đón</button>;
  const head = <div className="-mx-4 -mt-4 mb-2 bg-ink-900 px-4 py-3 text-white md:mx-0 md:mt-0 md:rounded-2xl"><div className="text-xs opacity-70">Giao bé · {o.child.className}</div><b className="text-lg">🧒 {o.child.fullName}</b></div>;
  if (done) return <div className="mx-auto max-w-md space-y-3">{head}<div className="rounded-2xl bg-mint-100 p-4 text-mint-700" data-testid="handover-done">✅ {done.text}</div>
    {done.warnings.map(w => <p key={w.code} className="rounded-2xl bg-sun-100 p-3 text-sm">⚠ {w.message}</p>)}<Link href="/pickups" className="btn block text-center">Xong</Link></div>;
  if (form) return <div className="mx-auto max-w-md space-y-3">{head}{back}<NewRequest attendanceId={attendanceId} init={form} onDone={(r) => { setForm(null); load(); setSel({ kind: "pickup_request", id: r.id }) }} /></div>;
  if (sel) return <div className="mx-auto max-w-md space-y-3">{head}{back}<Detail o={o} sel={sel} reload={load} onDone={setDone} /></div>;
  const absent = o.status === "absent";
  return <div className="mx-auto max-w-md space-y-3" data-testid="handover-list">{head}
    {o.pickedUp && <div className="rounded-2xl bg-mint-100 p-4 text-mint-700" data-testid="handover-picked">🏠 Bé đã được <b>{o.pickedUp.pickedUpByName}</b>{o.pickedUp.relation ? ` (${o.pickedUp.relation})` : ""} đón lúc {hhmm(o.pickedUp.pickedUpAt)}</div>}
    {absent && <p className="rounded-2xl bg-ink-100 p-3">Bé vắng hôm nay.</p>}
    {o.requests.length > 0 && <h2 className="font-semibold">Người ngoài danh sách</h2>}
    {o.requests.map(r => { const [c, l] = REQ_CHIP[r.status] ?? REQ_CHIP.expired; return <button key={r.id} data-testid="handover-request" onClick={() => setSel({ kind: "pickup_request", id: r.id })}
      className={`card flex min-h-14 w-full items-center gap-3 text-left ${r.status === "pending" && r.escalation?.due ? "border-2 border-rose-500" : ""}`}>
      <PersonPhoto url={r.photoUrl} alt={r.pickerName} className="h-14 w-14 shrink-0" /><span className="flex-1"><b>{r.pickerName}</b>{r.relation && ` (${r.relation})`}<span className="block text-xs text-ink-500">{r.className ? `${r.className} · ` : ""}gửi {hhmm(r.createdAt)}</span></span>
      <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${c}`}>{r.escalation?.due && r.status === "pending" ? "⏰ Gọi PH" : l}</span></button> })}
    <h2 className="font-semibold">Bố mẹ / người giám hộ</h2>
    {o.guardians.map(g => <button key={g.id} disabled={!g.canPickup} data-testid="handover-guardian" onClick={() => setSel({ kind: "guardian", id: g.id })}
      className={`card flex min-h-14 w-full items-center justify-between text-left ${g.canPickup ? "" : "bg-rose-100"}`}>
      <span><b>{g.fullName}</b> <span className="text-ink-500">({g.relation})</span><span className="block text-xs text-ink-500">Căn cước {idLast4(g.idNumberMasked)}</span></span>
      <span className="text-sm">{g.canPickup ? (g.canHandOver ? "Đối chiếu ›" : "") : "⛔ Không được đón"}</span></button>)}
    {o.authorizedPickers.length > 0 && <h2 className="font-semibold">Người đón hộ phụ huynh đăng ký</h2>}
    {o.authorizedPickers.map(p => <div key={p.id} className={`card flex items-center gap-3 ${p.status === "approved" ? "" : p.status === "pending" ? "bg-sun-100" : "bg-rose-100"}`} data-testid="handover-delegate" data-status={p.status}>
      <PersonPhoto url={p.photoUrl} alt={p.fullName} className="h-14 w-14 shrink-0" />
      <div className="flex-1"><b>{p.fullName}</b>{p.relation && ` (${p.relation})`}<div className="text-xs text-ink-500">Căn cước {idLast4(p.idNumberMasked)}</div>
        {p.status === "pending" && <div className="text-xs">Chưa được trường duyệt: phải tạo yêu cầu đón, đủ 2 xác nhận mới giao</div>}
        {p.status === "rejected" && <div className="text-xs text-rose-500">⛔ Trường đã từ chối, không giao bé</div>}</div>
      {p.status === "approved" && <button className="min-h-12 rounded-xl bg-mint-500 px-3 text-sm text-white" onClick={() => setSel({ kind: "authorized_picker", id: p.id })}>Đối chiếu ›</button>}
      {p.status === "pending" && !o.pickedUp && !absent && <button className="min-h-12 rounded-xl bg-sun-500 px-3 text-sm" data-testid="delegate-to-request" onClick={() => setForm({ pickerName: p.fullName, pickerPhone: p.phone1, relation: p.relation ?? undefined })}>Tạo yêu cầu</button>}</div>)}
    {!o.pickedUp && !absent && <button className="btn min-h-14 w-full !bg-peach-500 disabled:!bg-ink-100" onClick={() => setForm({})} data-testid="handover-new-request">+ Người khác đến đón</button>}
  </div>;
}

function Detail({ o, sel, reload, onDone }: { o: PickupOptions; sel: Sel; reload: () => void; onDone: (d: { text: string; warnings: MultiWarning[] }) => void }) {
  const [idt, setIdt] = useState<Identity | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [checked, setChecked] = useState(false);
  const [reqOverride, setReq] = useState<PickupRequest | null>(null);
  useEffect(() => { pickupIdentity(o.attendanceId, sel.kind, sel.id).then(setIdt).catch(e => setErr(e.message)) }, [o.attendanceId, sel.kind, sel.id]); // audit-logged by backend
  const g = sel.kind === "guardian" ? o.guardians.find(x => x.id === sel.id) : undefined;
  const p = sel.kind === "authorized_picker" ? o.authorizedPickers.find(x => x.id === sel.id) : undefined;
  const r0 = sel.kind === "pickup_request" ? o.requests.find(x => x.id === sel.id) : undefined;
  const r = r0 && reqOverride && reqOverride.id === r0.id ? { ...r0, ...reqOverride, canHandOver: r0.canHandOver } : r0;
  const item = g ?? p ?? r; if (!item) return <p className="text-ink-500">Không tìm thấy người đón.</p>;
  const name = g?.fullName ?? p?.fullName ?? r!.pickerName; const relation = g?.relation ?? p?.relation ?? r?.relation;
  const can = item.canHandOver; const blockers = item.blockers ?? [];
  const give = async () => { setBusy(true); setErr("");
    try { const res = await handOver(o.attendanceId, g ? { guardianId: g.id } : p ? { authorizedPickerId: p.id } : { pickupRequestId: r!.id });
      onDone({ text: `Đã giao bé ${o.child.fullName} cho ${res.pickedUpByName ?? name} lúc ${hhmm(res.pickedUpAt)}. Phụ huynh đã được báo.`, warnings: res.warnings ?? [] }) }
    catch (e) { setErr(pickupErrorText(e)); reload() } finally { setBusy(false) } };
  return <div className="space-y-3" data-testid="handover-detail" data-kind={sel.kind}>
    <PersonPhoto url={idt?.photoUrl ?? (p?.photoUrl ?? r?.photoUrl)} alt={name} className="h-72 w-full" testid="handover-photo" />
    <div className="text-center"><div className="text-2xl font-bold">{name}</div>
      <div>{relation ? `${relation} của bé · ` : ""}Căn cước <b data-testid="handover-cccd">{idt ? idFirstLast(idt.idNumber) : "…"}</b></div>
      <div className="text-xs text-ink-500">Đối chiếu ảnh và căn cước bản cứng trước khi giao</div></div>
    {r && <><StepTick label="Phụ huynh" s={r.parent} testid="tick-parent" /><StepTick label="Nhà trường" s={r.school} testid="tick-school" />
      {r.note && <p className="text-sm text-ink-500">Ghi chú: “{r.note}”</p>}
      <CallPanel r={r} onChange={nr => { setReq(nr); reload() }} /></>}
    {(r?.warnings ?? []).map(w => <p key={w.code} className="rounded-2xl bg-sun-100 p-3 text-sm" data-testid="multi-warning">⚠ {w.message}</p>)}
    {!can && blockers.length > 0 && <ul className="space-y-1 text-sm text-rose-500" data-testid="handover-blockers">{blockers.map(b => <li key={b}>• {BLOCKER_TEXT[b] ?? b}</li>)}</ul>}
    {!r && can && <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-mint-50 px-4"><input type="checkbox" className="h-6 w-6" checked={checked} onChange={e => setChecked(e.target.checked)} data-testid="handover-checked" />Đã đối chiếu ảnh và căn cước</label>}
    {err && <p className="text-sm text-rose-500" data-testid="handover-error">{err}</p>}
    <button className="min-h-14 w-full rounded-2xl bg-mint-500 text-lg font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" data-testid="handover-give"
      disabled={busy || !can || (!r && !checked)} onClick={give}>{can ? `Giao bé cho ${name}` : r ? "🔒 Giao bé (cần đủ 2 xác nhận)" : "🔒 Không thể giao bé"}</button></div>;
}

function NewRequest({ attendanceId, init, onDone }: { attendanceId: string; init: { pickerName?: string; pickerPhone?: string; relation?: string }; onDone: (r: PickupRequest) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [preview, setPreview] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setErr(""); const f = new FormData(e.currentTarget);
    for (const k of ["relation", "pickerIdNumber"]) if (!String(f.get(k) ?? "").trim()) f.delete(k);
    const raw = f.get("photo") as File | null;
    if (raw && raw.size) { if (!isAllowedPhoto(raw)) return setErr("Ảnh phải là JPG, PNG hoặc HEIC");
      const ph = await shrinkImage(raw); if (ph.size > PHOTO_MAX_BYTES && !isHeic(ph)) return setErr("Ảnh tối đa 3MB"); f.set("photo", ph) } else f.delete("photo");
    setBusy(true); try { onDone(await createRequest(attendanceId, f)) } catch (x) { setErr(pickupErrorText(x)) } finally { setBusy(false) } }
  return <form onSubmit={submit} className="card space-y-2" data-testid="request-form"><b>Người ngoài danh sách đến đón</b>
    <p className="text-xs text-ink-500">Cần phụ huynh xác nhận VÀ Ban giám hiệu / trực đón duyệt mới được giao bé. Phụ huynh nhận thông báo kèm ảnh.</p>
    <label className="flex min-h-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-mint-50 text-mint-700">
      {preview ? <PreviewImg src={preview} /> : "📷 Chụp ảnh người đón"}
      <input type="file" name="photo" accept={PHOTO_ACCEPT} capture="environment" className="sr-only" data-testid="request-photo" onChange={e => { const x = e.target.files?.[0]; setPreview(x ? URL.createObjectURL(x) : null) }} /></label>
    <input name="pickerName" className="input" placeholder="Họ tên người đón" required defaultValue={init.pickerName} maxLength={120} />
    <input name="pickerPhone" className="input" placeholder="Số điện thoại" inputMode="tel" required defaultValue={init.pickerPhone} />
    <input name="relation" className="input" placeholder="Quan hệ với bé (vd: Bác)" defaultValue={init.relation} maxLength={40} />
    <input name="pickerIdNumber" className="input" placeholder="Số căn cước (12 số)" inputMode="numeric" pattern="\d{12}" maxLength={12} />
    <textarea name="note" className="input" placeholder="Ai báo, báo lúc nào (bắt buộc)" required maxLength={500} />
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <button className="btn min-h-12 w-full" disabled={busy}>{busy ? "Đang gửi…" : "Gửi phụ huynh xác nhận"}</button></form>;
}
