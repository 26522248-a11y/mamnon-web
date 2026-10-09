"use client";
import { useCallback, useEffect, useRef, useState } from "react"; import { API_ORIGIN, api, http, softGet } from "@/lib/api"; import { ClassRoom, Paged } from "@/lib/types"; import { vnDateTime } from "@/lib/fmt"; import { Att, Gallery, Thumb } from "@/components/AnnImages";
type Ann = { id: string; title: string; body: string; scope: "school" | "class"; classId: string | null; className: string | null; audience: "all" | "parents" | "staff" | "specific"; createdBy: string; authorName: string; createdAt: string; important?: boolean; isImportant?: boolean; recipientCount?: number; canRecall?: boolean; recalled?: boolean; status?: "scheduled" | "sent" | "revoked"; scheduledAt?: string | null; sentAt?: string | null; canEdit?: boolean; attachments?: Att[] };
type Up = { key: string; name: string; preview: string; pct: number; att?: Att; err?: string };
const MAX_IMG = 6, MAX_MB = 10;
/** Giờ VN hiện tại: [YYYY-MM-DD, HH:mm] */
const vnNow = (ms = Date.now()) => { const t = new Date(ms + 7 * 3600e3).toISOString(); return [t.slice(0, 10), t.slice(11, 16)] as const };
/** Mốc gợi ý kế tiếp: 07:30 (trước giờ đón) / 16:30 (giờ đón). */
function nextSlot(): [string, string] { const [d, hm] = vnNow(); if (hm < "07:00") return [d, "07:30"]; if (hm < "16:00") return [d, "16:30"]; return [vnNow(Date.now() + 864e5)[0], "07:30"] }
const hmDm = (iso: string) => `${iso.slice(11, 16)} · ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function left(iso: string) { const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000); return m < 1 ? "Sắp gửi" : m < 60 ? `Còn ${m} phút` : m < 1440 ? `Còn ${Math.floor(m / 60)} giờ` : `Còn ${Math.round(m / 1440)} ngày` }
type Parent = { id: string; name: string; username: string; phone: string | null; note?: string };
/** Đọc Swagger để biết backend đã hỗ trợ "quan trọng" / "chọn phụ huynh" chưa — chưa có thì ẩn nút. */
type Feat = { important: string | null; recipients: boolean };
async function detect(): Promise<Feat> {
  const d = await softGet<{ components?: { schemas?: Record<string, { properties?: Record<string, { enum?: string[] }> }> } }>(API_ORIGIN + "/api/docs-json");
  const pr = d?.components?.schemas?.CreateAnnouncementDto?.properties ?? {};
  return { important: "important" in pr ? "important" : "isImportant" in pr ? "isImportant" : null, recipients: "recipientUserIds" in pr && !!pr.audience?.enum?.includes("specific") };
}
const AUD: Record<string, string> = { all: "Phụ huynh và nhân viên", parents: "Chỉ phụ huynh", staff: "Chỉ nhân viên" };
const AUD_LABEL: Record<string, string> = { ...AUD, specific: "Phụ huynh được chọn" };
export default function Announcements() {
  const me = api.me()!; const admin = me.role === "admin"; const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [feat, setFeat] = useState<Feat>({ important: null, recipients: false }); const [important, setImportant] = useState(false);
  const [parents, setParents] = useState<Parent[]>([]); const [picked, setPicked] = useState<Set<string>>(new Set()); const [q, setQ] = useState("");
  const [scope, setScope] = useState<"school" | "class" | "pick">(admin ? "school" : "class"); const [classId, setClassId] = useState(""); const [audience, setAudience] = useState<"all" | "parents" | "staff">(admin ? "all" : "parents");
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [list, setList] = useState<Ann[]>([]); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [ups, setUps] = useState<Up[]>([]); const [later, setLater] = useState(false); const [slot, setSlot] = useState<[string, string]>(nextSlot); const [editing, setEditing] = useState<Ann | null>(null); const [sched, setSched] = useState<Ann[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const whenIso = `${slot[0]}T${slot[1]}:00+07:00`; const past = later && new Date(whenIso).getTime() < Date.now() + 60000; const uploading = ups.some(u => !u.att && !u.err);
  function addFiles(fl: FileList | null) { if (!fl) return; const room = MAX_IMG - ups.length; const arr = Array.from(fl);
    if (arr.length > room) setMsg(`Tối đa ${MAX_IMG} ảnh – đã bỏ ${arr.length - Math.max(room, 0)} ảnh`);
    for (const f of arr.slice(0, Math.max(room, 0))) { const key = Math.random().toString(36).slice(2); const isHeic = /hei[cf]$/i.test(f.name) || /hei[cf]/.test(f.type);
      const u: Up = { key, name: f.name, preview: isHeic ? "" : URL.createObjectURL(f), pct: 0 };
      if (f.size > MAX_MB * 1048576) { setUps(x => [...x, { ...u, err: `> ${MAX_MB}MB` }]); continue }
      setUps(x => [...x, u]); const fd = new FormData(); fd.append("file", f);
      http.uploadProgress<Att>("/announcements/attachments", fd, pct => setUps(x => x.map(y => y.key === key ? { ...y, pct } : y)))
        .then(att => setUps(x => x.map(y => y.key === key ? { ...y, pct: 100, att } : y)))
        .catch(e => setUps(x => x.map(y => y.key === key ? { ...y, err: (e as Error).message } : y))) } }
  function removeUp(u: Up) { setUps(x => x.filter(y => y.key !== u.key)); if (u.preview) URL.revokeObjectURL(u.preview);
    if (u.att && !editing?.attachments?.some(a => a.id === u.att!.id)) http.del(`/announcements/attachments/${u.att.id}`).catch(() => {}) }
  function reset() { setImportant(false); setPicked(new Set()); setTitle(""); setBody(""); setUps([]); setEditing(null); setLater(false); setSlot(nextSlot()) }
  function edit(a: Ann) { setEditing(a); setTitle(a.title); setBody(a.body); setImportant(!!(a.important || a.isImportant)); setLater(true);
    if (a.scheduledAt) setSlot([a.scheduledAt.slice(0, 10), a.scheduledAt.slice(11, 16)]);
    setUps((a.attachments ?? []).map(x => ({ key: x.id, name: "", preview: "", pct: 100, att: x }))); setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" }) }
  async function cancelSched(a: Ann) { if (!confirm(`Huỷ hẹn gửi "${a.title}"? Thông báo sẽ không được gửi.`)) return;
    try { await http.post(`/announcements/${a.id}/cancel`); setMsg("Đã huỷ hẹn gửi"); if (editing?.id === a.id) reset(); load() } catch (x) { setMsg((x as Error & { errorCode?: string }).errorCode === "NOT_SCHEDULED" ? "Thông báo đã được gửi, không thể huỷ hẹn" : "❌ " + (x as Error).message); load() } }
  useEffect(() => { api.classes().then(c => { const mine = admin ? c : c.filter(x => me.classIds?.includes(x.id)); setClasses(mine); setClassId(mine[0]?.id ?? "") }).catch(() => {}) }, [admin, me.classIds]);
  useEffect(() => { detect().then(setFeat) }, []);
  const canPick = feat.recipients;
  useEffect(() => { if (scope !== "pick" || !canPick) return;
    type R = { userId: string; name: string; phone: string | null; children: { fullName: string; className: string | null; relation: string | null }[] };
    // GET /announcements/recipients: admin thấy mọi phụ huynh, giáo viên chỉ phụ huynh lớp mình
    http.get<{ items: R[] }>(`/announcements/recipients${!admin && classId ? `?classId=${classId}` : ""}`)
      .then(r => setParents(r.items.map(x => ({ id: x.userId, name: x.name, username: "", phone: x.phone, note: x.children.map(c => `${c.relation ? c.relation + " " : ""}bé ${c.fullName}${c.className ? ` (${c.className})` : ""}`).join(", ") }))))
      .catch(() => { if (admin) http.get<{ items: Parent[] }>("/users?role=parent&active=true&limit=500").then(r => setParents(r.items)).catch(() => {}) }) }, [scope, canPick, admin, classId]);
  const load = useCallback(() => { http.get<Paged<Ann>>("/announcements?limit=50").then(p => setList(p.items)).catch(() => {}); http.get<Paged<Ann>>("/announcements?status=scheduled&limit=50").then(p => setSched(p.items)).catch(() => setSched([])) }, []);
  useEffect(() => { load() }, [load]);
  const cls = classes.find(c => c.id === classId) as (ClassRoom & { childCount?: number }) | undefined;
  async function send(e: React.FormEvent) { e.preventDefault(); if (!title.trim() || !body.trim()) { setMsg("Vui lòng nhập tiêu đề và nội dung"); return } setBusy(true); setMsg("");
    if (uploading) { setMsg("Đợi ảnh tải xong"); setBusy(false); return } if (past) { setMsg("Giờ đã qua – chọn giờ khác"); setBusy(false); return }
    const attachmentIds = ups.filter(u => u.att).map(u => u.att!.id); const extra = { attachmentIds, ...(later ? { scheduledAt: whenIso } : {}) };
    if (editing) { try { await http.patch(`/announcements/${editing.id}`, { title: title.trim(), body: body.trim(), scheduledAt: whenIso, attachmentIds, ...(feat.important ? { [feat.important]: important } : {}) });
        reset(); setMsg("Đã cập nhật hẹn gửi ✔"); load() } catch (x) { setMsg((x as Error & { errorCode?: string }).errorCode === "NOT_SCHEDULED" ? "Thông báo đã được gửi, không sửa được nữa" : "❌ " + (x as Error).message); load() } finally { setBusy(false) } return }
    if (scope === "pick" && !picked.size) { setMsg("Chọn ít nhất một phụ huynh"); setBusy(false); return }
    try { await http.post("/announcements", { title: title.trim(), body: body.trim(), ...extra,
        ...(scope === "pick" ? { audience: "specific", recipientUserIds: Array.from(picked), ...(!admin && classId ? { classId } : {}) } : { scope, audience, ...(scope === "class" ? { classId } : {}) }), ...(feat.important ? { [feat.important]: important } : {}) });
      reset(); setMsg(later ? `Đã hẹn gửi ${slot[1]} · ${slot[0].slice(8, 10)}/${slot[0].slice(5, 7)} ✔` : "Đã gửi thông báo ✔"); load() }
    catch (x) { setMsg("❌ " + (x as Error).message) } finally { setBusy(false) } }
  async function del(id: string) { if (!confirm("Thu hồi thông báo này? Phụ huynh sẽ không còn thấy tin.")) return; try { await http.del(`/announcements/${id}`); setMsg("Đã thu hồi thông báo"); load() } catch (x) { setMsg((x as Error & { code?: number }).code === 409 ? "Thông báo đã được thu hồi trước đó" : "❌ " + (x as Error).message); load() } }
  const chip = (on: boolean) => `min-h-12 rounded-xl px-4 text-sm font-semibold ${on ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-700"}`;
  return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-bold">{editing ? "Sửa thông báo hẹn giờ" : "Soạn thông báo"}</h1>
    <form onSubmit={send} className="card space-y-3" data-testid="ann-form">
      <input className="input" placeholder="Tiêu đề, ví dụ: Nghỉ lễ 20/11" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} data-testid="ann-title" />
      {!editing && <div className="flex flex-wrap gap-2">{admin && <button type="button" className={chip(scope === "school")} onClick={() => setScope("school")} data-testid="ann-scope-school">Toàn trường</button>}
        <button type="button" className={chip(scope === "class")} onClick={() => setScope("class")} data-testid="ann-scope-class">Theo lớp</button>
        {canPick && <button type="button" className={chip(scope === "pick")} onClick={() => setScope("pick")} data-testid="ann-scope-pick">Chọn phụ huynh</button>}
        {(scope === "class" || (scope === "pick" && !admin && classes.length > 1)) && <select className="input !w-auto" value={classId} onChange={e => setClassId(e.target.value)} data-testid="ann-class">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        {scope !== "pick" && <select className="input !w-auto" value={audience} onChange={e => setAudience(e.target.value as typeof audience)} data-testid="ann-audience">{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</div>}
      {!editing && scope === "pick" && <div className="space-y-2 rounded-2xl bg-ink-100/40 p-3" data-testid="ann-picker"><input className="input" placeholder="Tìm phụ huynh theo tên, SĐT…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-56 space-y-1 overflow-y-auto">{parents.filter(p => !q || `${p.name} ${p.username} ${p.phone ?? ""} ${p.note ?? ""}`.toLowerCase().includes(q.toLowerCase())).map(p => <label key={p.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-3">
          <input type="checkbox" className="h-5 w-5" checked={picked.has(p.id)} onChange={() => setPicked(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} data-testid="ann-pick-parent" /><span className="flex-1">{p.name} <span className="text-xs text-ink-500">{p.note ?? p.username}{p.phone ? ` · ${p.phone}` : ""}</span></span></label>)}</div>
        <div className="text-xs text-ink-500">Đã chọn {picked.size} phụ huynh</div></div>}
      <textarea className="input min-h-32" placeholder="Nội dung thông báo…" value={body} onChange={e => setBody(e.target.value)} maxLength={5000} data-testid="ann-body" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="space-y-2"><div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ảnh đính kèm · {ups.length}/{MAX_IMG}</div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="ann-uploads">{ups.map(u => <div key={u.key} className="relative aspect-square overflow-hidden rounded-xl bg-ink-100" data-testid="ann-up">
            {u.att && !u.preview ? <Thumb a={u.att} className="h-full w-full" /> : u.preview ? <img src={u.preview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">🖼</div>}
            {!u.att && !u.err && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-xs font-semibold text-white">Đang tải {u.pct}%<div className="mt-1 h-1 w-3/4 rounded bg-white/40"><div className="h-1 rounded bg-white" style={{ width: `${u.pct}%` }} /></div></div>}
            {u.err && <div className="absolute inset-0 flex items-center justify-center bg-rose-500/80 p-1 text-center text-[10px] text-white" title={u.err}>Lỗi: {u.err}</div>}
            <button type="button" onClick={() => removeUp(u)} className="absolute right-0.5 top-0.5 h-7 w-7 rounded-full bg-black/60 text-xs text-white" aria-label="Bỏ ảnh" data-testid="ann-up-remove">✕</button></div>)}
          {ups.length < MAX_IMG && <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-sm text-ink-500" data-testid="ann-add-img">+<span>Ảnh</span></button>}</div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = "" }} data-testid="ann-file" /></div>
      <div className="space-y-2 rounded-2xl bg-sky-100/50 p-3"><div className="text-sm font-semibold">Thời điểm gửi</div>
        {!editing && <div className="grid grid-cols-2 gap-2"><button type="button" className={chip(!later)} onClick={() => setLater(false)} data-testid="ann-now">Gửi ngay</button><button type="button" className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${later ? "bg-sky-500 text-white" : "bg-ink-100 text-ink-700"}`} onClick={() => setLater(true)} data-testid="ann-later">⏰ Hẹn giờ</button></div>}
        {later && <><div className="grid grid-cols-2 gap-2"><input type="date" className="input" value={slot[0]} min={vnNow()[0]} onChange={e => setSlot([e.target.value, slot[1]])} data-testid="ann-date" />
            <input type="time" className="input" value={slot[1]} onChange={e => setSlot([slot[0], e.target.value])} data-testid="ann-time" /></div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">Gợi ý: {(["07:30", "16:30"] as const).map(t => <button key={t} type="button" onClick={() => setSlot([slot[0], t])} className={`min-h-9 rounded-full px-3 font-semibold ${slot[1] === t ? "bg-sky-500 text-white" : "bg-white text-sky-500"}`} data-testid={`ann-preset-${t.replace(":", "")}`}>{t}</button>)}<span>{"(trước giờ đón · giờ đón)"}</span></div>
          {past && <p className="text-sm font-semibold text-rose-500" data-testid="ann-past">Giờ đã qua</p>}</>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-3 text-sm text-ink-500">{feat.important && <label className="flex min-h-12 items-center gap-2 font-semibold text-rose-500"><input type="checkbox" className="h-5 w-5" checked={important} onChange={e => setImportant(e.target.checked)} data-testid="ann-important" />🔴 Quan trọng</label>}
          Gửi tới: {scope === "pick" ? `${picked.size} phụ huynh đã chọn` : scope === "school" ? "toàn trường" : `lớp ${cls?.name ?? ""}${cls?.childCount ? ` (${cls.childCount} bé)` : ""}`}{scope !== "pick" && ` · ${AUD[audience].toLowerCase()}`}</span>
        <span className="flex gap-2">{editing && <button type="button" className="min-h-12 px-3 text-sm text-ink-500" onClick={() => { reset(); setMsg("") }}>Bỏ sửa</button>}
          <button className={`btn disabled:!bg-ink-100 disabled:!text-ink-500 ${later ? "!bg-sky-500" : "!bg-peach-500"}`} disabled={busy || uploading || past} data-testid="btn-send-ann">{busy ? "Đang gửi…" : uploading ? "Đang tải ảnh…" : later ? `⏰ ${editing ? "Lưu hẹn" : "Hẹn gửi"} ${slot[1]} · ${slot[0].slice(8, 10)}/${slot[0].slice(5, 7)}` : "Gửi thông báo"}</button></span></div>
      {msg && <p className="text-sm" data-testid="ann-msg">{msg}</p>}</form>
    {sched.length > 0 && <><h2 className="text-lg font-semibold">⏰ Đã hẹn ({sched.length})</h2>
    {sched.map(a => <div key={a.id} className="card space-y-2 border-l-4 border-sky-500" data-testid="ann-sched-item"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b>{a.title}</b>{!!a.attachments?.length && <span className="ml-1 text-xs text-ink-500">🖼 {a.attachments.length}</span>}
        <div className="text-xs text-ink-500">{a.audience === "specific" ? `${a.recipientCount ?? ""} phụ huynh được chọn`.trim() : a.scope === "school" ? "Toàn trường" : `Lớp ${a.className}`} · hẹn {a.scheduledAt && hmDm(a.scheduledAt)}</div></div>
      <span className="shrink-0 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-500">{a.scheduledAt && left(a.scheduledAt)}</span></div>
      {a.canEdit !== false && <div className="flex gap-2"><button className="min-h-12 flex-1 rounded-xl bg-ink-100 text-sm font-semibold" onClick={() => edit(a)} data-testid="btn-edit-sched">Sửa</button><button className="min-h-12 flex-1 rounded-xl bg-rose-100 text-sm font-semibold text-rose-500" onClick={() => cancelSched(a)} data-testid="btn-cancel-sched">Huỷ hẹn</button></div>}</div>)}</>}
    <h2 className="text-lg font-semibold">Thông báo đã gửi</h2>
    {list.map(a => <div key={a.id} className="card space-y-1" data-testid="ann-item"><div className="flex items-start justify-between gap-2"><div><b>{(a.important || a.isImportant) && <span className="mr-1 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white" data-testid="ann-important-badge">Quan trọng</span>}{a.title}</b><div className="text-xs text-ink-500">{a.audience === "specific" ? `${a.recipientCount ?? ""} phụ huynh được chọn`.trim() : a.scope === "school" ? "Toàn trường" : `Lớp ${a.className}`}{a.audience !== "specific" && ` · ${AUD_LABEL[a.audience]}`} · {a.authorName} · {vnDateTime(a.sentAt ?? a.createdAt)}</div></div>
      {a.recalled || a.status === "revoked" ? <span className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-500">Đã thu hồi</span> : (a.canRecall ?? (admin || a.createdBy === me.id)) && <button className="min-h-12 px-3 text-sm text-rose-500" onClick={() => del(a.id)} data-testid="btn-recall-ann">Thu hồi</button>}</div><p className="whitespace-pre-line text-sm">{a.body}</p>{!!a.attachments?.length && <Gallery items={a.attachments} cols={4} />}</div>)}
    {list.length === 0 && <p className="text-ink-500">Chưa có thông báo</p>}</div>;
}
