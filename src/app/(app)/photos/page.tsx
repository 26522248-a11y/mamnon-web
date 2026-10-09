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
import { createPost, newClientId, uploadOutcome, likePost, listPosts, MOCK_KIDS, MOCK_POSTS, photoErrorText, photoFileUrl, photosFeature, PhotoPost, PostPhoto, unhidePhoto } from "@/lib/photos-api";

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
      <p data-testid="hidden-reason">{p.hiddenReason === "CONSENT_MISSING" ? <>Ẩn vì phụ huynh {by} chưa cho đăng hình. Phụ huynh đồng ý thì cô bỏ ẩn được.</> : p.hiddenReason === "CONSENT_WITHDRAWN" || !p.hiddenReason ? <>Ẩn vì phụ huynh {by} đã tắt đồng ý{p.hiddenAt ? ` lúc ${fmtDateTime(p.hiddenAt)}` : ""}.</> : p.hiddenReason}</p>
      <p className="text-sm text-ink-500">Ảnh không bị xoá, phụ huynh khác không thấy ảnh này. Bật lại đồng ý không tự hiện ảnh.</p>
      {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}
      <button type="button" className="min-h-12 w-full rounded-2xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || waiting.length > 0}
        onClick={async () => { setBusy(true); setErr(""); try { await onUnhide(); onClose() } catch (e) { setErr(photoErrorText(e)) } finally { setBusy(false) } }} data-testid="btn-unhide">Hiện lại</button>
      {waiting.length > 0 && <p className="text-center text-sm text-ink-500" data-testid="unhide-wait">Chờ {waiting.join(", ")} bật đồng ý</p>}
      <button type="button" className="min-h-12 w-full rounded-2xl bg-ink-100 font-semibold text-ink-700" onClick={onClose}>Đóng</button></div></div>;
}

type Item = { key: string; /** clientId, stable across retries */ file: File; fail?: string; url: string; tags: string[]; bad?: { childId: string; name: string }[];
  /** A1: "Ẩn bé đi" – children without consent hidden on this photo (sent as hiddenForChildIds → saved hidden, parents don't see it) */ hide?: string[] };
function Composer({ classId, kids, live, onPosted }: { classId: string; kids: Kid[]; live: boolean; onPosted: (p: PhotoPost) => void }) {
  const fileRef = useRef<HTMLInputElement>(null); const itemsRef = useRef<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]); const [caption, setCaption] = useState(""); const [batch, setBatch] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [sum, setSum] = useState<{ posted: number; total: number } | null>(null);
  itemsRef.current = items; useEffect(() => () => itemsRef.current.forEach(i => URL.revokeObjectURL(i.url)), []);
  const drop = (keys: Set<string>) => setItems(xs => { xs.filter(x => keys.has(x.key)).forEach(x => URL.revokeObjectURL(x.url)); return xs.filter(x => !keys.has(x.key)) });
  const pick = (l: FileList | null) => { if (!l?.length) return; setErr(""); setSum(null); const arr = Array.from(l);
    const big = arr.find(f => f.size > MAX_MB * 1048576); if (big) { setErr(`Ảnh quá lớn (tối đa ${MAX_MB}MB mỗi ảnh): ${big.name}`); return }
    const room = MAX - items.length; if (arr.length > room) setErr(`Tối đa ${MAX} ảnh mỗi lần đăng`);
    setItems(xs => [...xs, ...arr.slice(0, Math.max(0, room)).map(file => ({ key: newClientId(), file, url: URL.createObjectURL(file), tags: [...batch] }))]) };
  // default set → whole batch; per-photo edits stay until the default chip is toggled again
  const toggleBatch = (id: string) => { const on = !batch.includes(id); setBatch(b => on ? [...b, id] : b.filter(x => x !== id));
    setItems(xs => xs.map(x => ({ ...x, tags: on ? Array.from(new Set([...x.tags, id])) : x.tags.filter(t => t !== id) }))) };
  const togglePhoto = (key: string, id: string) => setItems(xs => xs.map(x => x.key !== key ? x : { ...x, tags: x.tags.includes(id) ? x.tags.filter(t => t !== id) : [...x.tags, id],
    bad: (b => b?.length ? b : undefined)(x.bad?.filter(b => !(b.childId === id && x.tags.includes(id)))) }));
  // A1: photos tagging a child without consent (not hidden) must be removed or have the child hidden before posting
  const okKid = (id: string) => !!kids.find(k => k.childId === id)?.photoConsent;
  const open = (x: Item) => x.tags.filter(t => !okKid(t) && !(x.hide ?? []).includes(t));
  const flagged = items.filter(x => open(x).length > 0); const first = flagged[0];
  const hideKids = (key: string) => setItems(xs => xs.map(x => x.key !== key ? x : { ...x, hide: Array.from(new Set([...(x.hide ?? []), ...open(x)])) }));
  const noConsent = kids.filter(k => !k.photoConsent);
  const bad = items.filter(i => i.bad?.length); const badIds = new Set(bad.flatMap(i => i.tags.filter(t => i.bad!.some(b => b.childId === t))));
  const badNames = Array.from(new Set(bad.flatMap(i => i.bad!.map(b => short(b.name))))).join(", ");
  const GENERIC = "Không đăng được ảnh này, vui lòng thử lại";
  const send = async (list: Item[]) => { const ids = list.map(x => x.key), tags = list.map(x => x.tags);
    if (!live) { // mock: never sent; ?demo=422 simulates per-photo results (last 2 tagged children lack consent; ?demo=422c adds a clientId conflict on photo 1 once)
      const q = new URLSearchParams(location.search).get("demo"); const tagged = Array.from(new Set(tags.flat()));
      const no = kids.filter(k => tagged.includes(k.childId)).slice(-2).map(k => ({ childId: k.childId, name: k.fullName }));
      const results = list.map((x, index) => { const c = no.filter(k => x.tags.includes(k.childId));
        return { index, clientId: x.key, status: c.length || (q === "422c" && index === 0 && !x.key.startsWith("re-")) ? "rejected" as const : "created" as const, code: c.length ? "PHOTO_CONSENT_MISSING" : q === "422c" && index === 0 && !x.key.startsWith("re-") ? "CLIENT_ID_CONFLICT" : null, children: c } });
      const n = results.filter(r => r.status === "created").length;
      return uploadOutcome(ids, tags, n ? { ...MOCK_POSTS[0], id: "mock-new-" + Date.now(), photos: [], results } : null, n ? undefined : { errorCode: "PHOTO_CONSENT_MISSING", details: { results } })! }
    const f = new FormData(); list.forEach(x => f.append("files", x.file)); if (caption.trim()) f.append("caption", caption.trim());
    f.append("tags", JSON.stringify(tags)); f.append("clientIds", JSON.stringify(ids));
    if (list.some(x => x.hide?.length)) f.append("hiddenForChildIds", JSON.stringify(list.map(x => (x.hide ?? []).filter(id => x.tags.includes(id)))));
    try { return uploadOutcome(ids, tags, await createPost(classId, f))! } catch (e) { const o = uploadOutcome(ids, tags, null, e); if (o) return o; throw e } };
  const post = async () => { if (flagged.length) return; if (!live && !new URLSearchParams(location.search).get("demo")) { setErr("Sắp có: chưa đăng được ảnh thật, đây là màn hình mẫu."); return }
    setBusy(true); setErr(""); setSum(null); setSel(null); let list = items.map(x => ({ ...x, bad: undefined, fail: undefined })); const total = list.length;
    try { const o = await send(list); const posts = o.post && o.created.length ? [o.post] : []; const created = new Set(o.created);
      const rejected = new Map(o.rejected); const failed = new Set(o.failed);
      if (o.conflicts.length) { // fresh clientId, resend those photos once
        const re = new Map(o.conflicts.map(k => [k, (live ? "" : "re-") + newClientId()])); list = list.map(x => re.has(x.key) ? { ...x, key: re.get(x.key)! } : x);
        try { const o2 = await send(list.filter(x => Array.from(re.values()).includes(x.key))); if (o2.post && o2.created.length) posts.push(o2.post);
          o2.created.forEach(k => created.add(k)); o2.rejected.forEach((v, k) => rejected.set(k, v)); [...o2.failed, ...o2.conflicts].forEach(k => failed.add(k)) }
        catch { re.forEach(k => failed.add(k)) } }
      posts.forEach(onPosted); list.filter(x => created.has(x.key)).forEach(x => URL.revokeObjectURL(x.url));
      setItems(list.filter(x => !created.has(x.key)).map(x => ({ ...x, bad: rejected.get(x.key), fail: failed.has(x.key) ? GENERIC : undefined })));
      setSum({ posted: created.size, total }); if (created.size === total) { setCaption(""); setBatch([]) } }
    catch (e) { setErr(photoErrorText(e)) } finally { setBusy(false) } };
  const allowed = kids.filter(k => k.photoConsent).length; const cur = items.find(x => x.key === sel);
  const chip = (k: Kid, on: boolean, onClick: () => void, tid: string, isBad = false) =>
    <button key={k.childId} type="button" onClick={onClick} data-testid={tid} data-allowed={k.photoConsent} data-missing={isBad || undefined}
      title={k.photoConsent ? "Phụ huynh đã cho phép đăng ảnh" : "Phụ huynh chưa cho đăng hình: ảnh có bé sẽ không đăng được"}
      className={`min-h-12 rounded-full border-2 px-3 text-sm font-semibold ${isBad ? "border-rose-500" : on ? "border-mint-500" : "border-transparent"} ${!k.photoConsent ? (on ? "!border-rose-500 bg-rose-100 text-rose-600" : "border-dashed !border-rose-300 bg-white text-rose-600") : on ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-700"}`}>
      {k.photoConsent ? <span className="mr-1 text-mint-700" aria-label="được phép">✓</span> : <span className="mr-1" aria-label="chưa cho đăng hình">🚫</span>}{short(k.fullName)}</button>;
  return <div className="card space-y-3" data-testid="composer">
    <b className="block">Đăng ảnh hoạt động</b>
    {noConsent.length > 0 && <div className="space-y-2 rounded-2xl bg-rose-100 p-3" data-testid="no-consent-banner">
      <b className="text-rose-600">🚫 {noConsent.length} bé chưa cho đăng hình</b>
      <div className="flex flex-wrap gap-3">{noConsent.map(k => <span key={k.childId} className="flex w-16 flex-col items-center text-center text-xs" data-testid="no-consent-kid">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-rose-500 bg-peach-100 text-lg font-bold text-ink-700">{k.fullName.trim().split(/\s+/).pop()?.[0]}</span>{short(k.fullName)}</span>)}</div>
      <p className="text-xs text-ink-700">Ảnh có các bé này sẽ không đăng được. Gắn tên bé vào ảnh có bé để được nhắc.</p></div>}
    {sum && sum.posted > 0 && (sum.posted === sum.total ? <p className="rounded-2xl bg-mint-50 p-3 font-semibold text-mint-700" data-testid="post-ok">✓ Đã đăng {sum.total} ảnh</p>
      : <p className="rounded-2xl bg-sun-100 p-3 font-semibold text-ink-700" data-testid="post-partial">Đã đăng {sum.posted}/{sum.total} ảnh · {sum.total - sum.posted} ảnh chưa đăng được</p>)}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden onChange={e => { pick(e.target.files); e.target.value = "" }} data-testid="file-input" />
    <div><div className="mb-1 text-sm font-semibold">Gắn tên cho cả loạt ảnh <span className="font-normal text-ink-500">· ✓ = phụ huynh đã cho phép ({allowed}/{kids.length})</span></div>
      <div className="flex flex-wrap gap-2" data-testid="tag-chips">{kids.map(k => chip(k, batch.includes(k.childId), () => toggleBatch(k.childId), `chip-${k.childId}`, badIds.has(k.childId)))}</div>
      {noConsent.length > 0 && <p className="mt-1 text-xs text-ink-500">🚫 = phụ huynh chưa cho đăng hình. Vẫn gắn tên được để biết ảnh nào cần bỏ hoặc ẩn bé.</p>}</div>
    {items.length === 0 ? <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-300 text-ink-500" data-testid="btn-pick">
      <span className="text-3xl">📷</span><span className="font-semibold">Chọn ảnh (tối đa {MAX} ảnh)</span></button>
      : <><p className="text-xs text-ink-500">Chạm vào ảnh để thêm/bớt tên riêng cho ảnh đó.</p>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">{items.map(x => <div key={x.key} className="space-y-0.5" data-testid="compose-photo" data-bad={x.bad || x.fail ? true : undefined} data-flagged={open(x).length ? true : undefined}>
          <div className={`relative aspect-square overflow-hidden rounded-xl border-2 ${open(x).length || x.bad || x.fail ? "border-rose-500" : sel === x.key ? "border-mint-500" : "border-transparent"}`}>
            <button type="button" className="block h-full w-full" onClick={() => setSel(s => s === x.key ? null : x.key)} aria-label="Gắn tên cho ảnh này" data-testid="compose-photo-tap"><img src={x.url} alt="" className="h-full w-full object-cover" /></button>
            <button type="button" aria-label="Bỏ ảnh" onClick={() => { drop(new Set([x.key])); if (sel === x.key) setSel(null) }} className="absolute right-0 top-0 flex h-12 w-12 items-start justify-end p-1"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/70 text-xs text-white">✕</span></button>
            {open(x).length > 0 ? <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-rose-500 px-1 py-0.5 text-center text-xs font-semibold text-white" data-testid="flag-label">Có {open(x).map(id => short(kids.find(k => k.childId === id)?.fullName ?? "")).join(", ")}</span>
              : x.hide?.some(id => x.tags.includes(id)) ? <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-ink-900/80 px-1 py-0.5 text-center text-xs text-white" data-testid="hidden-label">🙈 Đã ẩn bé</span>
              : x.tags.length > 0 && <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-ink-900/70 px-2 py-0.5 text-xs text-white">🏷 {x.tags.length}</span>}</div>
          {x.bad ? <div className="text-xs font-semibold text-rose-600" data-testid="compose-photo-bad">{(s => s[0].toUpperCase() + s.slice(1))(x.bad.map(b => short(b.name)).join(", "))} chưa được phụ huynh cho phép</div>
            : x.fail ? <div className="text-xs font-semibold text-rose-600" data-testid="compose-photo-fail">{x.fail}</div>
            : <div className="truncate text-xs text-ink-500">{x.tags.map(t => kids.find(k => k.childId === t)).filter(Boolean).map(k => short(k!.fullName)).join(", ") || "Chưa gắn tên"}</div>}</div>)}
          {items.length < MAX && <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-2xl text-ink-500" aria-label="Thêm ảnh">＋</button>}</div></>}
    {cur && <div className="space-y-2 rounded-2xl bg-ink-100/50 p-3" data-testid="photo-tagger"><div className="flex items-center gap-2"><img src={cur.url} alt="" className="h-12 w-12 rounded-lg object-cover" /><b className="flex-1 text-sm">Tên trong ảnh này</b>
        <button type="button" className="min-h-12 rounded-xl px-3 text-sm font-semibold text-mint-700" onClick={() => setSel(null)}>Xong</button></div>
      <div className="flex flex-wrap gap-2">{kids.map(k => chip(k, cur.tags.includes(k.childId), () => togglePhoto(cur.key, k.childId), `ptag-${k.childId}`, !!cur.bad?.some(b => b.childId === k.childId) && cur.tags.includes(k.childId)))}</div></div>}
    {first && <div className="space-y-2 rounded-2xl border-2 border-rose-500 bg-white p-3" data-testid="flag-panel">
      <b className="block text-rose-600">Ảnh {items.indexOf(first) + 1} có {open(first).map(id => short(kids.find(k => k.childId === id)?.fullName ?? "")).join(", ")} (chưa đồng ý)</b>
      <div className="grid grid-cols-2 gap-2"><button type="button" className="min-h-12 rounded-xl border border-ink-100 bg-white font-semibold" onClick={() => { drop(new Set([first.key])); if (sel === first.key) setSel(null) }} data-testid="btn-drop-flagged">🗑 Bỏ ảnh này</button>
        <button type="button" className="min-h-12 rounded-xl bg-ink-900 font-semibold text-white" onClick={() => hideKids(first.key)} data-testid="btn-hide-kid">🙈 Ẩn bé đi</button></div>
      <p className="text-xs text-ink-500">Ẩn bé: ảnh chỉ cô giáo thấy, phụ huynh không thấy cho đến khi được đồng ý.</p></div>}
    <textarea className="input min-h-12" maxLength={300} rows={2} placeholder="Lời nhắn (không bắt buộc)" value={caption} onChange={e => setCaption(e.target.value)} data-testid="caption" />
    {bad.length > 0 && <div className="space-y-2 rounded-2xl bg-rose-100 p-3 text-rose-600" role="alert" data-testid="consent-missing">
      <p className="font-semibold">Chưa đăng được {bad.length} ảnh: {badNames} chưa được phụ huynh cho phép</p>
      <button type="button" className="min-h-12 w-full rounded-2xl bg-white font-semibold text-rose-600" onClick={() => { drop(new Set(bad.map(x => x.key))); setSel(null); fileRef.current?.click() }} data-testid="btn-pick-other">Chọn ảnh khác</button></div>}
    {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}
    <button type="button" className="min-h-12 w-full rounded-2xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy || items.length === 0 || flagged.length > 0} onClick={post} data-testid="btn-post">
      {busy ? "Đang đăng…" : flagged.length ? `Đăng ${items.length} ảnh · còn ${flagged.length} ảnh cần xử lý` : !live ? "Đăng (Sắp có)" : items.length && items.every(x => x.bad || x.fail) ? "Thử đăng lại" : `Đăng ${items.length || ""} ảnh`}</button></div>;
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
