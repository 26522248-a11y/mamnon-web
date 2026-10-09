"use client";
/** Admin: audit log — who did what, when, before → after, reason. Filters: child, action, actor, date range. */
import { DateField } from "@/components/DateField"; import { useCallback, useEffect, useState } from "react"; import Link from "next/link";
import { api, http, todayStr } from "@/lib/api"; import { Child } from "@/lib/types";
import { actionLabel, AuditEvent, auditActions, fieldLabel, fieldValue, hiddenField, listAudit } from "@/lib/audit-api"; import { fmtDateTime } from "@/lib/date";

type U = { id: string; name: string; role: string };
const ROLE: Record<string, string> = { admin: "Ban giám hiệu", teacher: "GV", accountant: "KT", parent: "PH" };
const LIMIT = 30;
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE") };

export default function AuditPage() {
  const me = api.me()!;
  const [f, setF] = useState({ childId: "", action: "", actorId: "", from: addDays(todayStr(), -7), to: todayStr() }); const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditEvent[] | null>(null); const [total, setTotal] = useState(0); const [err, setErr] = useState("");
  const [actions, setActions] = useState<[string, string][]>([]); const [users, setUsers] = useState<U[]>([]);
  const [childQ, setChildQ] = useState(""); const [kids, setKids] = useState<Child[]>([]); const [childName, setChildName] = useState("");
  useEffect(() => { auditActions().then(setActions); http.get<{ items: U[] }>("/users?limit=200").then(r => setUsers(r.items)).catch(() => {}) }, []);
  useEffect(() => { if (childQ.trim().length < 2) { setKids([]); return } const t = setTimeout(() => api.children({ search: childQ.trim(), limit: 8 }).then(r => setKids(r.items)).catch(() => {}), 300); return () => clearTimeout(t) }, [childQ]);
  const load = useCallback(() => { setErr(""); listAudit({ ...f, from: f.from || undefined, to: f.to || undefined, page, limit: LIMIT }).then(r => { setRows(r.items); setTotal(r.total) }).catch(e => { setErr((e as { code?: number }).code === 404 ? "Máy chủ chưa bật nhật ký thao tác (GET /audit-events chưa triển khai)." : e.message); setRows([]) }) }, [f, page]);
  useEffect(() => { load() }, [load]);
  if (me.role !== "admin") return <p className="text-ink-500">Chỉ Ban giám hiệu xem nhật ký hệ thống.</p>;
  const upd = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setPage(1) };
  return <div className="mx-auto max-w-5xl space-y-4" data-testid="audit-page"><h1 className="text-2xl font-bold">Nhật ký thao tác</h1>
    <div className="card grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="audit-filters">
      <div className="relative min-w-0 sm:col-span-2">{f.childId ? <button className="input flex min-h-12 items-center justify-between text-left" onClick={() => { upd({ childId: "" }); setChildName(""); setChildQ("") }} data-testid="audit-child-clear">🧒 {childName} <span className="text-rose-500">✕</span></button>
        : <input className="input" placeholder="Tìm bé (gõ 2 chữ)…" value={childQ} onChange={e => setChildQ(e.target.value)} data-testid="audit-child" />}
        {!f.childId && kids.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-2xl bg-white p-1 shadow-lg">{kids.map(k => <button key={k.id} className="block min-h-12 w-full rounded-xl px-3 text-left hover:bg-mint-50"
          onClick={() => { upd({ childId: k.id }); setChildName(k.fullName); setKids([]) }}>{k.fullName} <span className="text-xs text-ink-500">{k.className}</span></button>)}</div>}</div>
      <select className="input min-w-0" value={f.action} onChange={e => upd({ action: e.target.value })} data-testid="audit-action"><option value="">Mọi thao tác</option>{actions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select className="input min-w-0" value={f.actorId} onChange={e => upd({ actorId: e.target.value })} data-testid="audit-actor"><option value="">Mọi người</option>{users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE[u.role] ?? u.role})</option>)}</select>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2"><DateField className="min-w-0" value={f.from} max={f.to || undefined} onChange={v => upd({ from: v })} data-testid="audit-from" aria-label="Từ ngày" />
        <DateField className="min-w-0" value={f.to} min={f.from || undefined} onChange={v => upd({ to: v })} data-testid="audit-to" aria-label="Đến ngày" /></div></div>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    {rows?.length === 0 && !err && <p className="text-ink-500">Không có thao tác nào khớp bộ lọc.</p>}
    <div className="space-y-2">{rows?.map(e => { const keys = Array.from(new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})])).filter(k => !hiddenField(k, e.before?.[k], e.after?.[k]));
      return <div key={e.id} className="card space-y-2 text-sm" data-testid="audit-row">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-mint-700">{actionLabel(e.action)}</span>
          <b>{e.actorName ?? "Hệ thống"}</b>{e.actorRole && <span className="text-ink-500">({ROLE[e.actorRole] ?? e.actorRole})</span>}
          {e.childId && <Link href={`/children/${e.childId}`} className="text-mint-700 underline">🧒 {e.childName ?? "Hồ sơ bé"}</Link>}
          <span className="ml-auto text-ink-500">{fmtDateTime(e.at)}</span></div>
        {keys.length > 0 && <table className="w-full text-xs" data-testid="audit-diff"><thead className="text-left text-ink-500"><tr><th className="w-1/4">Mục</th><th>Trước</th><th>Sau</th></tr></thead>
          <tbody>{keys.map(k => { const b = fieldValue(e.before?.[k]), a = fieldValue(e.after?.[k]); return <tr key={k} className="border-t border-ink-100 align-top"><td className="py-1 font-semibold">{fieldLabel(k)}</td>
            <td className={`py-1 break-all ${b !== a ? "text-rose-500 line-through" : ""}`}>{b}</td><td className={`py-1 break-all ${b !== a ? "font-semibold text-mint-700" : ""}`}>{a}</td></tr> })}</tbody></table>}
        {e.reason && <p className="rounded-xl bg-sun-100 p-2" data-testid="audit-reason">Lý do: {e.reason}</p>}</div> })}</div>
    {total > LIMIT && <div className="flex items-center justify-center gap-2"><button className="btn min-h-12 !bg-white !text-ink-700" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
      <span className="text-sm">Trang {page}/{Math.ceil(total / LIMIT)} · {total} thao tác</span><button className="btn min-h-12 !bg-white !text-ink-700" disabled={page * LIMIT >= total} onClick={() => setPage(page + 1)}>›</button></div>}
  </div>;
}
