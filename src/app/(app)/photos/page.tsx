"use client";
/* eslint-disable @next/next/no-img-element */
/**
 * Ảnh hoạt động lớp (wave 3, round3-api §2). Until /classes/{id}/photo-posts is in Swagger: mock data + "Sắp có", nothing is sent.
 * Consent is shown inverted: children who ARE allowed get a ✓; children without consent can't be tagged (chip disabled).
 * 422 PHOTO_CONSENT_MISSING (e.g. consent turned off meanwhile) → rose box above "Đăng" naming the children, their chips get a rose-500
 * border, one button "Chọn ảnh khác"; chips stay editable. Hidden photos: teacher sees 40% + "🙈 Đã ẩn", tap → reason + "Hiện lại"
 * (disabled until every tagged child consents). Parents: hidden photos are not rendered at all.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, http } from "@/lib/api"; import { ClassRoom } from "@/lib/types"; import { fmtDateTime } from "@/lib/date";
import { consentMissing, consentRejects, createPost, likePost, listPosts, MOCK_KIDS, MOCK_POSTS, photoErrorText, photoFileUrl, photosFeature, PhotoPost, PostPhoto, unhidePhoto } from "@/lib/photos-api";

type Kid = { childId: string; fullName: string; photoConsent: boolean };
const short = (n: string) => "bé " + (n.trim().split(/\s+/).pop() ?? n);
const MAX = 20, MAX_MB = 15;

function Thumb({ p, live, className }: { p: PostPhoto; live: boolean; className: string }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { if (!live) return; let url: string | null = null; http.blobUrl(photoFileUrl(p.id)).then(x => { url = x; setU(x) }); return () => { if (url) URL.revokeObjectURL(url) } }, [p.id, live]);
  if (!live) return <div className={`flex items-center justify-center text-5xl ${p.bg ?? "bg-ink-100"} ${className}`}>{p.emoji ?? "🖼️"}</div>;
  return u ? <img src={u} alt="" className={`object-cover ${className}`} /> : <div className={`animate-pulse bg-ink-100 ${className}`} />;
}

function HiddenSheet({ p, kids, onClose, onUnhide }: { p: PostPhoto; kids: Kid[]; onClose: () => void; onUnhide: () => Promise<void> }) {
  const name = (id: string) => short(kids.find(k => k.childId === id)?.fullName ?? p.children?.find(c => c.childId === id)?.name ?? "?");
  const by = (p.hiddenForChildIds?.length ? p.hiddenForChildIds : p.childIds).map(name).join(", ");
  const waiting = Array.from(new Set([...(p.hiddenForChildIds ?? []), ...p.childIds])).filter(id => !kids.find(k => k.childId === id)?.photoConsent).map(name);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 md:items-center" onClick={onClose}>
    <div role="dialog" aria-modal className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 md:rounded-3xl" onClick={e => e.stopPropagation()} data-testid="hidden-sheet">
      <b className="block text-lg">🙈 Ảnh đang ẩn</b>
      <p data-testid="hidden-reason">{p.hiddenReason === "CONSENT_WITHDRAWN" || !p.hiddenReason ? <>Ẩn vì phụ huynh {by} đã tắt đồng ý{p.hiddenAt ? ` lúc ${fmtDateTime(p.hiddenAt)}` : ""}.</> : p.hiddenReason}</p>
      <p className="text-sm text-ink-500">Ảnh không bị xoá, phụ huynh khác không thấy ảnh này. Bật lại đồng ý không tự hiện ảnh.</p>
      {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}
      <button type="button" className="min-h-12 w-full rounded-2xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || waiting.length > 0}
        onClick={async () => { setBusy(true); setErr(""); try { await onUnhide(); onClose() } catch (e) { setErr(photoErrorText(e)) } finally { setBusy(false) } }} data-testid="btn-unhide">Hiện lại</button>
      {waiting.length > 0 && <p className="text-center text-sm text-ink-500" data-testid="unhide-wait">Chờ {waiting.join(", ")} bật đồng ý</p>}
      <button type="button" className="min-h-12 w-full rounded-2xl bg-ink-100 font-semibold text-ink-700" onClick={onClose}>Đóng</button></div></div>;
}

type Item = { key: string; file: File; url: string; tags: string[]; bad?: { childId: string; name: string }[] };
function Composer({ classId, kids, live, onPosted }: { classId: string; kids: Kid[]; live: boolean; onPosted: (p: PhotoPost) => void }) {
  const fileRef = useRef<HTMLInputElement>(null); const itemsRef = useRef<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]); const [caption, setCaption] = useState(""); const [batch, setBatch] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  itemsRef.current = items; useEffect(() => () => itemsRef.current.forEach(i => URL.revokeObjectURL(i.url)), []);
  const drop = (keys: Set<string>) => setItems(xs => { xs.filter(x => keys.has(x.key)).forEach(x => URL.revokeObjectURL(x.url)); return xs.filter(x => !keys.has(x.key)) });
  const pick = (l: FileList | null) => { if (!l?.length) return; setErr(""); setOk(""); const arr = Array.from(l);
    const big = arr.find(f => f.size > MAX_MB * 1048576); if (big) { setErr(`Ảnh quá lớn (tối đa ${MAX_MB}MB mỗi ảnh): ${big.name}`); return }
    const room = MAX - items.length; if (arr.length > room) setErr(`Tối đa ${MAX} ảnh mỗi lần đăng`);
    setItems(xs => [...xs, ...arr.slice(0, Math.max(0, room)).map(file => ({ key: Math.random().toString(36).slice(2), file, url: URL.createObjectURL(file), tags: batch.filter(id => kids.find(k => k.childId === id)?.photoConsent) }))]) };
  // default set → whole batch; per-photo edits stay until the default chip is toggled again
  const toggleBatch = (id: string) => { const on = !batch.includes(id); setBatch(b => on ? [...b, id] : b.filter(x => x !== id));
    setItems(xs => xs.map(x => ({ ...x, tags: on ? Array.from(new Set([...x.tags, id])) : x.tags.filter(t => t !== id) }))) };
  const togglePhoto = (key: string, id: string) => setItems(xs => xs.map(x => x.key !== key ? x : { ...x, tags: x.tags.includes(id) ? x.tags.filter(t => t !== id) : [...x.tags, id],
    bad: (b => b?.length ? b : undefined)(x.bad?.filter(b => !(b.childId === id && x.tags.includes(id)))) }));
  const bad = items.filter(i => i.bad?.length); const badIds = new Set(bad.flatMap(i => i.tags.filter(t => i.bad!.some(b => b.childId === t))));
  const badNames = Array.from(new Set(bad.flatMap(i => i.bad!.map(b => short(b.name))))).join(", ");
  const send = async (list: Item[]) => { const f = new FormData(); list.forEach(x => f.append("files", x.file)); if (caption.trim()) f.append("caption", caption.trim());
    f.append("tags", JSON.stringify(list.map(x => x.tags))); return createPost(classId, f) };
  const finish = (posted: Item[], post: PhotoPost | null) => { if (post) onPosted(post); drop(new Set(posted.map(x => x.key)));
    if (posted.length) setOk(`Đã đăng ${posted.length} ảnh`) };
  const post = async () => { setBusy(true); setErr(""); setOk(""); setSel(null); const list = items.map(x => ({ ...x, bad: undefined })); setItems(list);
    try { if (!live) { // mock: never sent; ?demo=422 simulates the server rule (2 tagged children lose consent)
        const tagged = Array.from(new Set(list.flatMap(x => x.tags)));
        if (new URLSearchParams(location.search).get("demo") === "422" && tagged.length) throw { errorCode: "PHOTO_CONSENT_MISSING", details: { children: kids.filter(k => tagged.includes(k.childId)).slice(-2).map(k => ({ childId: k.childId, name: k.fullName })) } };
        setErr("Sắp có: chưa đăng được ảnh thật, đây là màn hình mẫu."); return }
      finish(list, await send(list)); setCaption(""); setBatch([]) }
    catch (e) { const r = consentRejects(e, list.map(x => x.tags)); if (!r) { setErr(photoErrorText(e)); return }
      if (!r.rejects.length) { setErr(`Chưa đăng được: ${(consentMissing(e) ?? []).map(c => short(c.name)).join(", ")} chưa được phụ huynh cho phép`); return }
      const badIdx = new Map(r.rejects.map(x => [x.index, x.children])); const marked = list.map((x, i) => badIdx.has(i) ? { ...x, bad: badIdx.get(i) } : x); setItems(marked);
      const clean = marked.filter(x => !x.bad);
      if (r.serverPosted) finish(clean, r.post);
      else if (clean.length && live) { try { finish(clean, await send(clean)) } catch (e2) { setErr(photoErrorText(e2)) } }
      else if (clean.length) setOk(`Mẫu: ${clean.length} ảnh còn lại sẽ được đăng`) }
    finally { setBusy(false) } };
  const allowed = kids.filter(k => k.photoConsent).length; const cur = items.find(x => x.key === sel);
  const chip = (k: Kid, on: boolean, onClick: () => void, tid: string, isBad = false) =>
    <button key={k.childId} type="button" disabled={!k.photoConsent && !on} onClick={onClick} data-testid={tid} data-allowed={k.photoConsent} data-missing={isBad || undefined}
      title={k.photoConsent ? "Phụ huynh đã cho phép đăng ảnh" : "Chưa được phụ huynh cho phép, không gắn tên được"}
      className={`min-h-12 rounded-full border-2 px-3 text-sm font-semibold ${isBad ? "border-rose-500" : on ? "border-mint-500" : "border-transparent"} ${on ? "bg-mint-100 text-mint-700" : k.photoConsent ? "bg-ink-100 text-ink-700" : "!bg-white text-ink-300 line-through decoration-ink-300"}`}>
      {k.photoConsent && <span className="mr-1 text-mint-700" aria-label="được phép">✓</span>}{short(k.fullName)}</button>;
  return <div className="card space-y-3" data-testid="composer">
    <b className="block">Đăng ảnh hoạt động</b>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden onChange={e => { pick(e.target.files); e.target.value = "" }} data-testid="file-input" />
    <div><div className="mb-1 text-sm font-semibold">Gắn tên cho cả loạt ảnh <span className="font-normal text-ink-500">· ✓ = phụ huynh đã cho phép ({allowed}/{kids.length})</span></div>
      <div className="flex flex-wrap gap-2" data-testid="tag-chips">{kids.map(k => chip(k, batch.includes(k.childId), () => toggleBatch(k.childId), `chip-${k.childId}`, badIds.has(k.childId)))}</div>
      {kids.some(k => !k.photoConsent) && <p className="mt-1 text-xs text-ink-500">Bé chưa có ✓ thì phụ huynh chưa cho phép, chưa gắn tên được.</p>}</div>
    {items.length === 0 ? <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-300 text-ink-500" data-testid="btn-pick">
      <span className="text-3xl">📷</span><span className="font-semibold">Chọn ảnh (tối đa {MAX} ảnh)</span></button>
      : <><p className="text-xs text-ink-500">Chạm vào ảnh để thêm/bớt tên riêng cho ảnh đó.</p>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">{items.map(x => <div key={x.key} className="space-y-0.5" data-testid="compose-photo" data-bad={x.bad ? true : undefined}>
          <div className={`relative aspect-square overflow-hidden rounded-xl border-2 ${x.bad ? "border-rose-500" : sel === x.key ? "border-mint-500" : "border-transparent"}`}>
            <button type="button" className="block h-full w-full" onClick={() => setSel(s => s === x.key ? null : x.key)} aria-label="Gắn tên cho ảnh này" data-testid="compose-photo-tap"><img src={x.url} alt="" className="h-full w-full object-cover" /></button>
            <button type="button" aria-label="Bỏ ảnh" onClick={() => { drop(new Set([x.key])); if (sel === x.key) setSel(null) }} className="absolute right-0 top-0 flex h-12 w-12 items-start justify-end p-1"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/70 text-xs text-white">✕</span></button>
            {x.tags.length > 0 && <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs text-white">🏷 {x.tags.length}</span>}</div>
          {x.bad ? <div className="text-xs font-semibold text-rose-600" data-testid="compose-photo-bad">{x.bad.map(b => short(b.name)).join(", ")} chưa được phép</div>
            : <div className="truncate text-xs text-ink-500">{x.tags.map(t => kids.find(k => k.childId === t)).filter(Boolean).map(k => short(k!.fullName)).join(", ") || "Chưa gắn tên"}</div>}</div>)}
          {items.length < MAX && <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-2xl text-ink-500" aria-label="Thêm ảnh">＋</button>}</div></>}
    {cur && <div className="space-y-2 rounded-2xl bg-ink-100/50 p-3" data-testid="photo-tagger"><div className="flex items-center gap-2"><img src={cur.url} alt="" className="h-12 w-12 rounded-lg object-cover" /><b className="flex-1 text-sm">Tên trong ảnh này</b>
        <button type="button" className="min-h-12 rounded-xl px-3 text-sm font-semibold text-mint-700" onClick={() => setSel(null)}>Xong</button></div>
      <div className="flex flex-wrap gap-2">{kids.map(k => chip(k, cur.tags.includes(k.childId), () => togglePhoto(cur.key, k.childId), `ptag-${k.childId}`, !!cur.bad?.some(b => b.childId === k.childId) && cur.tags.includes(k.childId)))}</div></div>}
    <textarea className="input min-h-12" maxLength={300} rows={2} placeholder="Lời nhắn (không bắt buộc)" value={caption} onChange={e => setCaption(e.target.value)} data-testid="caption" />
    {bad.length > 0 && <div className="space-y-2 rounded-2xl bg-rose-100 p-3 text-rose-600" role="alert" data-testid="consent-missing">
      <p className="font-semibold">Chưa đăng được {bad.length} ảnh: {badNames} chưa được phụ huynh cho phép</p>
      <button type="button" className="min-h-12 w-full rounded-2xl bg-white font-semibold text-rose-600" onClick={() => { drop(new Set(bad.map(x => x.key))); setSel(null); fileRef.current?.click() }} data-testid="btn-pick-other">Chọn ảnh khác</button></div>}
    {ok && <p className="rounded-2xl bg-mint-50 p-3 text-sm font-semibold text-mint-700" data-testid="post-ok">✓ {ok}</p>}
    {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}
    <button type="button" className="min-h-12 w-full rounded-2xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || items.length === 0} onClick={post} data-testid="btn-post">
      {busy ? "Đang đăng…" : live ? `Đăng ${items.length || ""} ảnh` : "Đăng (Sắp có)"}</button></div>;
}

export default function PhotosPage() {
  const me = api.me()!; const staff = me.role !== "parent";
  const [live, setLive] = useState<boolean | null>(null); const [classes, setClasses] = useState<ClassRoom[]>([]); const [classId, setClassId] = useState("");
  const [kids, setKids] = useState<Kid[]>([]); const [posts, setPosts] = useState<PhotoPost[]>([]); const [next, setNext] = useState<string | null>(null);
  const [open, setOpen] = useState<PostPhoto | null>(null); const [msg, setMsg] = useState("");
  useEffect(() => { photosFeature().then(setLive) }, []);
  useEffect(() => { if (live === null) return; if (!live) { setKids(MOCK_KIDS); setPosts(MOCK_POSTS); return }
    if (staff) api.classes().then(c => { const mine = me.role === "teacher" ? c.filter(x => me.classIds?.includes(x.id)) : c; setClasses(mine); setClassId(mine[0]?.id ?? "") });
    else api.children({ limit: 50 }).then(r => { const ids = Array.from(new Set((r.items ?? []).map(c => c.classId).filter(Boolean))) as string[]; setClassId(ids[0] ?? "") }) }, [live, staff, me.role, me.classIds]);
  const load = useCallback(async () => { if (!live || !classId) return; setMsg("");
    try { const [p, s] = await Promise.all([listPosts(classId), staff ? http.get<{ items: Kid[] }>(`/classes/${classId}/attendance?date=${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })}`) : null]);
      setPosts(p.items); setNext(p.nextBefore); if (s) setKids((s.items ?? []).map(k => ({ childId: k.childId, fullName: k.fullName, photoConsent: k.photoConsent === true }))) }
    catch (e) { setMsg(photoErrorText(e)) } }, [live, classId, staff]);
  useEffect(() => { load() }, [load]);
  const more = async () => { if (!next) return; const p = await listPosts(classId, next); setPosts(x => [...x, ...p.items]); setNext(p.nextBefore) };
  const shown = useMemo(() => staff ? posts : posts.map(p => ({ ...p, photos: p.photos.filter(x => !x.hidden) })).filter(p => p.photos.length > 0), [posts, staff]);
  const name = (id: string) => kids.find(k => k.childId === id)?.fullName;
  const unhide = async (p: PostPhoto) => { const r = live ? await unhidePhoto(p.id) : { ...p, hidden: false, hiddenReason: null };
    setPosts(ps => ps.map(x => ({ ...x, photos: x.photos.map(y => y.id === p.id ? { ...y, ...r } : y) }))) };
  const like = async (p: PhotoPost) => { const on = !p.likedByMe; setPosts(ps => ps.map(x => x.id === p.id ? { ...x, likedByMe: on, likeCount: x.likeCount + (on ? 1 : -1) } : x));
    if (live) try { await likePost(p.id, on) } catch { load() } };
  const download = async (p: PostPhoto) => { const u = await http.blobUrl(photoFileUrl(p.id, "full", true)); if (!u) return; const a = document.createElement("a"); a.href = u; a.download = `anh-lop-${p.id}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000) };
  if (live === null) return null;
  return <div className="space-y-4" data-testid="photos-page">
    <h1 className="text-2xl font-bold">Ảnh hoạt động lớp</h1>
    {!live && <div className="rounded-2xl bg-sun-100 p-3 text-sm text-ink-700" data-testid="photos-soon">🚧 <b>Sắp có</b> · Đây là màn hình mẫu với ảnh minh hoạ, chưa đăng hay tải ảnh thật.</div>}
    {staff && classes.length > 1 && <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    {staff && <Composer classId={classId} kids={kids} live={!!live} onPosted={p => setPosts(x => [p, ...x])} />}
    {msg && <p className="text-sm text-rose-600" role="alert">{msg}</p>}
    {shown.length === 0 && <p className="card text-center text-ink-500">Chưa có ảnh nào</p>}
    {shown.map(post => <div key={post.id} className="card space-y-2" data-testid={`post-${post.id}`}>
      <div className="flex items-baseline justify-between gap-2"><b>{post.author?.name ?? "Cô giáo"}</b><span className="text-xs text-ink-500">{fmtDateTime(post.createdAt)}</span></div>
      {post.caption && <p>{post.caption}</p>}
      <div className="grid grid-cols-2 gap-1 md:grid-cols-3">{post.photos.map(p => <div key={p.id} className="relative">
        <button type="button" className="block w-full" disabled={!p.hidden && !(staff ? false : p.mine)} onClick={() => p.hidden ? setOpen(p) : download(p)} data-testid={`photo-${p.id}`} data-hidden={p.hidden || undefined}
          aria-label={p.hidden ? "Ảnh đang ẩn, xem lý do" : p.mine ? "Tải ảnh" : "Ảnh"}>
          <Thumb p={p} live={!!live} className={`aspect-square w-full rounded-xl ${p.hidden ? "opacity-40" : ""}`} /></button>
        {p.hidden && <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs font-semibold text-white" data-testid="badge-hidden">🙈 Đã ẩn</span>}
        {!staff && p.mine && <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-mint-700">⬇ Tải</span>}
        {staff && p.childIds.length > 0 && <div className="mt-0.5 truncate text-xs text-ink-500">{p.childIds.map(id => name(id)).filter(Boolean).map(n => short(n!)).join(", ")}</div>}</div>)}</div>
      <button type="button" onClick={() => like(post)} className={`min-h-12 rounded-full px-3 text-sm font-semibold ${post.likedByMe ? "bg-rose-100 text-rose-600" : "bg-ink-100 text-ink-700"}`} data-testid="btn-like">
        {post.likedByMe ? "❤️" : "🤍"} {post.likeCount}</button></div>)}
    {next && <button type="button" className="min-h-12 w-full rounded-2xl bg-ink-100 font-semibold" onClick={more}>Xem thêm</button>}
    {open && staff && <HiddenSheet p={open} kids={kids} onClose={() => setOpen(null)} onUnhide={() => unhide(open)} />}
  </div>;
}
