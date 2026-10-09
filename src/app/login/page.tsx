"use client";
import { useState } from "react"; import { useRouter } from "next/navigation"; import { api, roleHome } from "@/lib/api"; import { APP_NAME, useSchool } from "@/lib/school";
export default function Login() {
  const r = useRouter(); const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const school = useSchool();
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr("");
    try { const me = await api.login(u, p); r.push(roleHome(me)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } }
  return <main className="flex min-h-screen items-center justify-center p-4">
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
      <div className="text-center"><div className="text-5xl">🌱</div><h1 className="mt-2 text-2xl font-bold text-mint-700" data-testid="school-name">{school?.name || APP_NAME}</h1><p className="text-sm text-ink-500">Đăng nhập hệ thống quản lý</p></div>
      <input className="input" placeholder="Tên đăng nhập" value={u} onChange={e => setU(e.target.value)} autoComplete="username" required />
      <input className="input" type="password" placeholder="Mật khẩu" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" required />
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
      {process.env.NEXT_PUBLIC_SHOW_DEMO === "1" && <p className="text-center text-xs text-slate-400" data-testid="demo-hint">Demo: admin / gv1 / ketoan / ph1, mật khẩu 123456</p>}
    </form></main>;
}
