"use client";
import { fmtDate } from "@/lib/date"; import { useEffect, useState } from "react"; import Link from "next/link"; import { Photo, WithdrawnBadge } from "@/components/Photo"; import { api } from "@/lib/api"; import { Child, ClassRoom, Paged } from "@/lib/types";
export default function Children() {
  const [data, setData] = useState<Paged<Child> | null>(null); const [page, setPage] = useState(1); const [search, setSearch] = useState("");
  const [classId, setClassId] = useState(""); const [classes, setClasses] = useState<ClassRoom[]>([]);
  useEffect(() => { api.classes().then(setClasses) }, []);
  useEffect(() => { const t = setTimeout(() => api.children({ page, limit: 10, search, classId: classId || undefined }).then(setData), 250); return () => clearTimeout(t) }, [page, search, classId]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1; const cname = (id: string) => classes.find(c => c.id === id)?.name ?? "";
  return <><h1 className="mb-4 text-2xl font-bold">Hồ sơ trẻ</h1>
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <input className="input" placeholder="Tìm theo tên..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      <select className="input sm:w-48" value={classId} onChange={e => { setClassId(e.target.value); setPage(1) }}><option value="">Tất cả lớp</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.items.map(c => <Link href={`/children/${c.id}`} key={c.id} className="card flex items-center gap-3 hover:ring-2 hover:ring-mint-300">
      <Photo url={(c as {photoUrl?: string}).photoUrl} id={c.id} withdrawn={c.status === "withdrawn"} size={48} />
      <div><div className="font-semibold">{c.fullName} {c.status === "withdrawn" && <WithdrawnBadge />}</div><div className="text-sm text-ink-500">{c.className ?? cname(c.classId)} · {fmtDate(c.dob)}</div>
      {c.allergies && <span className="text-xs text-red-600">⚠ Dị ứng: {c.allergies}</span>}</div></Link>)}</div>
    <div className="mt-4 flex items-center justify-center gap-3"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
      <span>Trang {page}/{pages} · {data?.total ?? 0} trẻ</span><button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</button></div></>;
}
