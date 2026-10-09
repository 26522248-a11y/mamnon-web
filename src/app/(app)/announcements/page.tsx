"use client";
import { useCallback, useEffect, useState } from "react"; import { API_ORIGIN, api, http, softGet } from "@/lib/api"; import { ClassRoom, Paged } from "@/lib/types"; import { vnDateTime } from "@/lib/fmt";
type Ann = { id: string; title: string; body: string; scope: "school" | "class"; classId: string | null; className: string | null; audience: "all" | "parents" | "staff" | "specific"; createdBy: string; authorName: string; createdAt: string; important?: boolean; isImportant?: boolean; recipientCount?: number; canRecall?: boolean; recalled?: boolean };
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
  useEffect(() => { api.classes().then(c => { const mine = admin ? c : c.filter(x => me.classIds?.includes(x.id)); setClasses(mine); setClassId(mine[0]?.id ?? "") }).catch(() => {}) }, [admin, me.classIds]);
  useEffect(() => { detect().then(setFeat) }, []);
  const canPick = feat.recipients;
  useEffect(() => { if (scope !== "pick" || !canPick) return;
    type R = { userId: string; name: string; phone: string | null; children: { fullName: string; className: string | null; relation: string | null }[] };
    // GET /announcements/recipients: admin thấy mọi phụ huynh, giáo viên chỉ phụ huynh lớp mình
    http.get<{ items: R[] }>(`/announcements/recipients${!admin && classId ? `?classId=${classId}` : ""}`)
      .then(r => setParents(r.items.map(x => ({ id: x.userId, name: x.name, username: "", phone: x.phone, note: x.children.map(c => `${c.relation ? c.relation + " " : ""}bé ${c.fullName}${c.className ? ` (${c.className})` : ""}`).join(", ") }))))
      .catch(() => { if (admin) http.get<{ items: Parent[] }>("/users?role=parent&active=true&limit=500").then(r => setParents(r.items)).catch(() => {}) }) }, [scope, canPick, admin, classId]);
  const load = useCallback(() => http.get<Paged<Ann>>("/announcements?limit=50").then(p => setList(p.items)).catch(() => {}), []);
  useEffect(() => { load() }, [load]);
  const cls = classes.find(c => c.id === classId) as (ClassRoom & { childCount?: number }) | undefined;
  async function send(e: React.FormEvent) { e.preventDefault(); if (!title.trim() || !body.trim()) { setMsg("Vui lòng nhập tiêu đề và nội dung"); return } setBusy(true); setMsg("");
    if (scope === "pick" && !picked.size) { setMsg("Chọn ít nhất một phụ huynh"); setBusy(false); return }
    try { await http.post("/announcements", { title: title.trim(), body: body.trim(),
        ...(scope === "pick" ? { audience: "specific", recipientUserIds: Array.from(picked), ...(!admin && classId ? { classId } : {}) } : { scope, audience, ...(scope === "class" ? { classId } : {}) }), ...(feat.important ? { [feat.important]: important } : {}) });
      setImportant(false); setPicked(new Set()); setTitle(""); setBody(""); setMsg("Đã gửi thông báo ✔"); load() }
    catch (x) { setMsg("❌ " + (x as Error).message) } finally { setBusy(false) } }
  async function del(id: string) { if (!confirm("Thu hồi thông báo này? Phụ huynh sẽ không còn thấy tin.")) return; try { await http.del(`/announcements/${id}`); setMsg("Đã thu hồi thông báo"); load() } catch (x) { setMsg((x as Error & { code?: number }).code === 409 ? "Thông báo đã được thu hồi trước đó" : "❌ " + (x as Error).message); load() } }
  const chip = (on: boolean) => `min-h-12 rounded-xl px-4 text-sm font-semibold ${on ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-700"}`;
  return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-bold">Soạn thông báo</h1>
    <form onSubmit={send} className="card space-y-3" data-testid="ann-form">
      <input className="input" placeholder="Tiêu đề, ví dụ: Nghỉ lễ 20/11" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} data-testid="ann-title" />
      <div className="flex flex-wrap gap-2">{admin && <button type="button" className={chip(scope === "school")} onClick={() => setScope("school")} data-testid="ann-scope-school">Toàn trường</button>}
        <button type="button" className={chip(scope === "class")} onClick={() => setScope("class")} data-testid="ann-scope-class">Theo lớp</button>
        {canPick && <button type="button" className={chip(scope === "pick")} onClick={() => setScope("pick")} data-testid="ann-scope-pick">Chọn phụ huynh</button>}
        {(scope === "class" || (scope === "pick" && !admin && classes.length > 1)) && <select className="input !w-auto" value={classId} onChange={e => setClassId(e.target.value)} data-testid="ann-class">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        {scope !== "pick" && <select className="input !w-auto" value={audience} onChange={e => setAudience(e.target.value as typeof audience)} data-testid="ann-audience">{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</div>
      {scope === "pick" && <div className="space-y-2 rounded-2xl bg-ink-100/40 p-3" data-testid="ann-picker"><input className="input" placeholder="Tìm phụ huynh theo tên, SĐT…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-56 space-y-1 overflow-y-auto">{parents.filter(p => !q || `${p.name} ${p.username} ${p.phone ?? ""} ${p.note ?? ""}`.toLowerCase().includes(q.toLowerCase())).map(p => <label key={p.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-3">
          <input type="checkbox" className="h-5 w-5" checked={picked.has(p.id)} onChange={() => setPicked(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} data-testid="ann-pick-parent" /><span className="flex-1">{p.name} <span className="text-xs text-ink-500">{p.note ?? p.username}{p.phone ? ` · ${p.phone}` : ""}</span></span></label>)}</div>
        <div className="text-xs text-ink-500">Đã chọn {picked.size} phụ huynh</div></div>}
      <textarea className="input min-h-32" placeholder="Nội dung thông báo…" value={body} onChange={e => setBody(e.target.value)} maxLength={5000} data-testid="ann-body" />
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-3 text-sm text-ink-500">{feat.important && <label className="flex min-h-12 items-center gap-2 font-semibold text-rose-500"><input type="checkbox" className="h-5 w-5" checked={important} onChange={e => setImportant(e.target.checked)} data-testid="ann-important" />🔴 Quan trọng</label>}
          Gửi tới: {scope === "pick" ? `${picked.size} phụ huynh đã chọn` : scope === "school" ? "toàn trường" : `lớp ${cls?.name ?? ""}${cls?.childCount ? ` (${cls.childCount} bé)` : ""}`}{scope !== "pick" && ` · ${AUD[audience].toLowerCase()}`}</span>
        <button className="btn !bg-peach-500 disabled:!bg-ink-100" disabled={busy} data-testid="btn-send-ann">{busy ? "Đang gửi…" : "Gửi thông báo"}</button></div>
      {msg && <p className="text-sm" data-testid="ann-msg">{msg}</p>}</form>
    <h2 className="text-lg font-semibold">Thông báo đã gửi</h2>
    {list.map(a => <div key={a.id} className="card space-y-1" data-testid="ann-item"><div className="flex items-start justify-between gap-2"><div><b>{(a.important || a.isImportant) && <span className="mr-1 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white" data-testid="ann-important-badge">Quan trọng</span>}{a.title}</b><div className="text-xs text-ink-500">{a.audience === "specific" ? `${a.recipientCount ?? ""} phụ huynh được chọn`.trim() : a.scope === "school" ? "Toàn trường" : `Lớp ${a.className}`}{a.audience !== "specific" && ` · ${AUD_LABEL[a.audience]}`} · {a.authorName} · {vnDateTime(a.createdAt)}</div></div>
      {a.recalled ? <span className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-500">Đã thu hồi</span> : (a.canRecall ?? (admin || a.createdBy === me.id)) && <button className="min-h-12 px-3 text-sm text-rose-500" onClick={() => del(a.id)} data-testid="btn-recall-ann">Thu hồi</button>}</div><p className="whitespace-pre-line text-sm">{a.body}</p></div>)}
    {list.length === 0 && <p className="text-ink-500">Chưa có thông báo</p>}</div>;
}
