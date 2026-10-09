"use client";
/** Screen 1 – Parent: "Ai được đón bé?" list + register a delegate (ảnh chân dung bắt buộc, CCCD 12 số, 2 SĐT). */
import { fmtDateTime } from "@/lib/date"; import { useCallback, useEffect, useState } from "react"; import Link from "next/link";
import { api } from "@/lib/api"; import { Child } from "@/lib/types"; import { ApiError } from "@/lib/types";
import { addDelegate, Delegate, idLast4, isAllowedPhoto, isHeic, PHOTO_ACCEPT, PHOTO_MAX_BYTES, PickupPeople, pickupPeople, removeDelegate, shrinkImage, updateContactPhones, ContactPhones, getContactPhones } from "@/lib/pickup-api";
import { PersonPhoto, PreviewImg } from "@/components/pickup-safety";

const CHIP: Record<string, [string, string]> = { approved: ["bg-mint-100 text-mint-700", "Đã duyệt"], pending: ["bg-sun-100 text-ink-900", "Chờ trường duyệt"], rejected: ["bg-rose-100 text-rose-500", "Trường từ chối"] };

export default function Delegates() {
  const me = api.me()!; const [kids, setKids] = useState<Child[]>([]); const [i, setI] = useState(0);
  const [p, setP] = useState<PickupPeople | null>(null); const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [adding, setAdding] = useState(false);
  useEffect(() => { api.children({ limit: 20 }).then(r => setKids(r.items)).catch(e => setErr(e.message)) }, []);
  const k = kids[i];
  const load = useCallback(() => { if (k) pickupPeople(k.id).then(setP).catch(e => setErr(e.message)) }, [k]);
  useEffect(() => { setP(null); load() }, [load]);
  if (me.role !== "parent") return <p className="text-ink-500">Trang này dành cho phụ huynh.</p>;
  if (err) return <p className="text-rose-500">{err}</p>;
  if (!k) return <p>Đang tải…</p>;
  const parents = p?.guardians.filter(g => g.canPickup) ?? [];
  const del = async (d: Delegate) => { if (!confirm(`Xoá ${d.fullName} khỏi danh sách người đón hộ?`)) return;
    try { await removeDelegate(d.id); setMsg(`Đã xoá ${d.fullName}`); load() } catch (e) { setMsg((e as Error).message) } };
  return <div className="mx-auto max-w-md space-y-4" data-testid="delegates-page">
    <Link href="/pickups" className="text-sm text-mint-700">‹ Đón bé</Link>
    <div><div className="text-sm text-ink-500">Phụ huynh · Người đón hộ</div><h1 className="text-2xl font-bold">Ai được đón bé {k.fullName.split(" ").pop()}?</h1></div>
    {kids.length > 1 && <div className="flex gap-2">{kids.map((x, j) => <button key={x.id} onClick={() => { setI(j); setAdding(false) }} className={`min-h-12 rounded-xl px-4 ${j === i ? "bg-mint-500 text-white" : "bg-white"}`}>{x.fullName.split(" ").pop()}</button>)}</div>}
    {!p ? <p>Đang tải…</p> : <>
      {parents.map(g => <div key={g.id} className="card flex items-center gap-3" data-testid="guardian-row"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-peach-100 text-2xl">👤</span>
        <div className="flex-1"><b>{g.relation} · {g.fullName}</b><div className="text-sm text-ink-500">CCCD {idLast4(g.idNumberMasked)}</div></div>
        <span className="rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-mint-700">Bố mẹ / giám hộ</span></div>)}
      {p.authorizedPickers.map(d => { const [cls, label] = CHIP[d.status] ?? CHIP.pending;
        return <div key={d.id} className="card space-y-2" data-testid="delegate-row" data-status={d.status}><div className="flex items-center gap-3">
          <PersonPhoto url={d.photoUrl} alt={d.fullName} className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1"><b>{d.relation ? `${d.relation} · ` : ""}{d.fullName}</b><div className="text-sm text-ink-500">CCCD {idLast4(d.idNumberMasked)}</div>
            <div className="text-sm text-ink-500">① {d.phone1}{d.phone2 && <> · ② {d.phone2}</>}</div></div>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${cls}`} data-testid="delegate-status">{label}</span></div>
          {d.status === "pending" && <p className="text-xs text-ink-500">Chưa có hiệu lực: nhà trường duyệt xong thì người này mới đón bé được (cô giáo đối chiếu ảnh + CCCD).</p>}
          {d.status === "rejected" && d.decisionNote && <p className="text-sm text-rose-500">Lý do: {d.decisionNote}</p>}
          <button className="min-h-12 text-sm text-rose-500 underline" onClick={() => del(d)} data-testid="delegate-remove">Xoá người này</button></div> })}
      {adding ? <AddForm childId={k.id} onDone={(name) => { setAdding(false); setMsg(`Đã gửi ${name}, chờ nhà trường duyệt`); load() }} onCancel={() => setAdding(false)} />
        : <button className="min-h-14 w-full rounded-2xl border-2 border-dashed border-mint-500 font-semibold text-mint-700" onClick={() => { setAdding(true); setMsg("") }} data-testid="delegate-add">+ Thêm người đón hộ</button>}
      {msg && <p className="text-sm" data-testid="delegates-msg">{msg}</p>}
      <MyPhones key={k.id} childId={k.id} onSaved={m => { setMsg(m); load() }} /></>}
  </div>;
}

function AddForm({ childId, onDone, onCancel }: { childId: string; onDone: (name: string) => void; onCancel: () => void }) {
  const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview]);
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setErr("");
    const f = new FormData(e.currentTarget); const raw = f.get("photo") as File | null;
    if (!raw || !raw.size) return setErr("Cần chụp ảnh chân dung người đón");
    if (!isAllowedPhoto(raw)) return setErr("Ảnh phải là JPG, PNG hoặc HEIC");
    const photo = await shrinkImage(raw); // HEIC the browser can't decode → sent as-is
    if (photo.size > PHOTO_MAX_BYTES && !isHeic(photo)) return setErr("Ảnh tối đa 3MB, vui lòng chụp lại"); f.set("photo", photo);
    const id = String(f.get("idNumber") ?? "").replace(/\s/g, ""); if (!/^\d{12}$/.test(id)) return setErr("Số CCCD phải đúng 12 chữ số"); f.set("idNumber", id);
    if (!String(f.get("phone2") ?? "").trim()) f.delete("phone2");
    setBusy(true);
    try { const d = await addDelegate(childId, f); onDone(d.fullName) }
    catch (x) { setErr(x instanceof ApiError && x.code === 409 ? "Người này đã có trong danh sách đón bé" : (x as Error).message) } finally { setBusy(false) } }
  return <form onSubmit={submit} className="card space-y-3 border-2 border-dashed border-mint-500" data-testid="delegate-form">
    <b>+ Thêm người đón hộ</b>
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-mint-50 text-mint-700" data-testid="delegate-photo-label">
      {preview ? <PreviewImg src={preview} /> : <span>📷 Chụp ảnh chân dung (bắt buộc)</span>}
      <input type="file" name="photo" accept={PHOTO_ACCEPT} capture="user" className="sr-only" data-testid="delegate-photo"
        onChange={e => { const file = e.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : null) }} /></label>
    <input name="fullName" className="input" placeholder="Họ tên" required maxLength={120} data-testid="delegate-name" />
    <input name="relation" className="input" placeholder="Quan hệ với bé (vd: Bà ngoại)" required maxLength={40} data-testid="delegate-relation" />
    <input name="idNumber" className="input" placeholder="Số CCCD (12 số)" inputMode="numeric" pattern="\d{12}" maxLength={12} required data-testid="delegate-cccd" />
    <input name="phone1" className="input" placeholder="📞 Số điện thoại ①" inputMode="tel" required data-testid="delegate-phone1" />
    <input name="phone2" className="input" placeholder="📞 Số điện thoại ② (nếu có)" inputMode="tel" data-testid="delegate-phone2" />
    <p className="text-xs text-ink-500">CCCD chỉ hiển thị 4 số cuối. Người mới thêm phải được nhà trường duyệt mới có hiệu lực.</p>
    {err && <p className="text-sm text-rose-500" data-testid="delegate-error">{err}</p>}
    <div className="flex gap-2"><button className="btn min-h-12 flex-1" disabled={busy} data-testid="delegate-submit">{busy ? "Đang gửi…" : "Gửi nhà trường duyệt"}</button>
      <button type="button" className="btn min-h-12 flex-1 !bg-ink-300" onClick={onCancel}>Hủy</button></div></form>;
}

/** Parent's own ① / ② numbers (called in order after 15 minutes). Saving asks for confirmation; the school is notified. */
function MyPhones({ childId, onSaved }: { childId: string; onSaved: (msg: string) => void }) {
  const [cp, setCp] = useState<ContactPhones | null>(null);
  useEffect(() => { getContactPhones(childId).then(setCp).catch(() => {}) }, [childId]);
  // what the teacher will actually dial: parent-set numbers, else guardian phones (backend callOrder)
  const initial = cp ? (cp.callOrder.length ? cp.callOrder.map(x => x.phone) : [cp.phone1, cp.phone2].filter(Boolean) as string[]) : [];
  const [edit, setEdit] = useState(false); const [p1, setP1] = useState(""); const [p2, setP2] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const open = () => { setP1(initial[0] ?? ""); setP2(initial[1] ?? ""); setErr(""); setEdit(true) };
  const ok = (v: string) => /^[0-9+ ]{8,20}$/.test(v);
  const save = async () => { const a = p1.replace(/\s/g, ""), b = p2.replace(/\s/g, ""); setErr("");
    if (!ok(a)) return setErr("Số ① không hợp lệ"); if (b && !ok(b)) return setErr("Số ② không hợp lệ"); if (a === b) return setErr("Số ② phải khác số ①");
    if (!confirm(`Đổi số liên hệ khẩn thành ① ${a}${b ? ` · ② ${b}` : ""}?\nNhà trường sẽ được thông báo về thay đổi này.`)) return;
    setBusy(true); try { setCp(await updateContactPhones(childId, { phone1: a, phone2: b })); setEdit(false); onSaved("Đã cập nhật số liên hệ, nhà trường đã được thông báo") }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  return <div className="card space-y-2" data-testid="my-phones"><div className="flex items-center justify-between"><b className="text-sm">Số liên hệ khẩn của bạn</b>
    {!edit && <button className="min-h-12 px-2 text-sm text-mint-700 underline" onClick={open} data-testid="my-phones-edit">Sửa</button>}</div>
    {edit ? <>
      <input className="input" inputMode="tel" value={p1} onChange={e => setP1(e.target.value)} placeholder="Số ① (gọi trước)" data-testid="my-phone1" />
      <input className="input" inputMode="tel" value={p2} onChange={e => setP2(e.target.value)} placeholder="Số ② (nếu có)" data-testid="my-phone2" />
      <p className="rounded-xl bg-sun-100 p-2 text-xs" data-testid="my-phones-note">ℹ️ Nhà trường sẽ được thông báo khi bạn đổi số liên hệ.</p>
      {err && <p className="text-sm text-rose-500" data-testid="my-phones-error">{err}</p>}
      <div className="flex gap-2"><button className="btn min-h-12 flex-1" disabled={busy} onClick={save} data-testid="my-phones-save">Lưu</button>
        <button className="btn min-h-12 flex-1 !bg-ink-300" onClick={() => setEdit(false)}>Hủy</button></div></>
      : <div className="text-sm">{initial.length ? initial.map((x, j) => <span key={x} className="mr-3">{j ? "②" : "①"} {x}</span>) : "Chưa có số điện thoại"}</div>}
    {cp?.updatedAt && <p className="text-xs text-ink-500">Sửa lần cuối: {cp.updatedByName ?? ""} · {fmtDateTime(cp.updatedAt)}</p>}
    {cp && !cp.phone1 && <p className="text-xs text-ink-500">Chưa đặt riêng: đang dùng số trong hồ sơ phụ huynh.</p>}
    <p className="text-xs text-ink-500">Quá 15 phút chưa xác nhận người đón, cô giáo sẽ gọi lần lượt số ① rồi ②.</p></div>;
}
