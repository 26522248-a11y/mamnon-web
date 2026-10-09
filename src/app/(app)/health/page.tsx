"use client";
import { useEffect, useState } from "react"; import Link from "next/link";
import { api } from "@/lib/api"; import { Child, ClassRoom } from "@/lib/types"; import { Photo } from "@/components/Photo";
export default function HealthIndex() {
  const me = api.me(); const [classes, setClasses] = useState<ClassRoom[]>([]); const [classId, setClassId] = useState(""); const [kids, setKids] = useState<Child[]>([]); const [search, setSearch] = useState("");
  useEffect(() => { if (me?.role !== "parent") api.classes().then(c => { setClasses(c); if (me?.role === "teacher") setClassId(me.classIds?.[0] ?? c[0]?.id ?? "") }).catch(() => {}) }, [me?.role, me?.classIds]);
  useEffect(() => { const t = setTimeout(() => api.children({ limit: 50, classId: classId || undefined, search }).then(p => setKids(p.items)), 200); return () => clearTimeout(t) }, [classId, search]);
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Sức khỏe</h1>
    {me?.role !== "parent" && <div className="flex flex-col gap-2 sm:flex-row"><input className="input" placeholder="Tìm bé..." value={search} onChange={e => setSearch(e.target.value)} />
      <select className="input sm:w-48" value={classId} onChange={e => setClassId(e.target.value)} data-testid="health-class"><option value="">Tất cả lớp</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{kids.map(c => <Link key={c.id} href={`/health/${c.id}`} data-testid="health-child" className="card flex min-h-16 items-center gap-3 hover:ring-2 hover:ring-mint-300">
      <Photo url={c.photoUrl} id={c.id} size={48} /><div><div className="font-semibold">{c.fullName}</div><div className="text-sm text-ink-500">{c.className}{c.allergies ? ` · ⚠ ${c.allergies}` : ""}</div></div></Link>)}</div></div>;
}
