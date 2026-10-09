"use client";
import { useEffect, useState } from "react"; import { useRouter } from "next/navigation"; import { api } from "@/lib/api";
import { parentFeed, PickupRequest } from "@/lib/pickup-api"; import { PickupConfirmCard, useKeptConfirmed } from "@/components/PickupConfirmCard";
/** PM decision pending (default ON): first-login parents see pending pickup confirm cards above the form. Set NEXT_PUBLIC_PICKUP_ON_CHANGE_PASSWORD=0 to turn off. */
const PICKUP_ON_CHANGE_PASSWORD = process.env.NEXT_PUBLIC_PICKUP_ON_CHANGE_PASSWORD !== "0";
function strength(p: string) { let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s }
const LV = [["bg-rose-500", "Yếu"], ["bg-rose-500", "Yếu"], ["bg-sun-500", "Trung bình"], ["bg-mint-300", "Khá"], ["bg-mint-500", "Mạnh"]];
export default function ChangePassword() {
  const r = useRouter(); const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [cf, setCf] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const me = typeof window !== "undefined" ? api.me() : null; useEffect(() => { if (!api.me()) r.replace("/login") }, [r]);
  const [feed, setFeed] = useState<PickupRequest[]>([]); const [pmsg, setPmsg] = useState(""); const { keep, show } = useKeptConfirmed();
  const parent = me?.role === "parent";
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => { const m = api.me(); if (m && !m.mustChangePassword) setBack(m.role === "parent" ? "/account" : m.role === "teacher" ? "/attendance" : "/dashboard") }, []);
  useEffect(() => { if (!PICKUP_ON_CHANGE_PASSWORD || api.me()?.role !== "parent") return;
    const f = () => parentFeed().then(x => setFeed(x.items)).catch(() => {}); f(); const t = setInterval(f, 10000); return () => clearInterval(t) }, []);
  const pinned = parent ? feed.filter(show) : [];
  const s = strength(nw);
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr("");
    if (nw.length < 6) return setErr("Mật khẩu mới cần ít nhất 6 ký tự"); if (nw !== cf) return setErr("Mật khẩu nhập lại không khớp"); if (nw === cur) return setErr("Mật khẩu mới phải khác mật khẩu cũ");
    setBusy(true); try { await api.changePassword(cur, nw); const m = api.me(); r.replace(m?.role === "teacher" ? "/attendance" : m?.role === "parent" ? "/today" : "/dashboard") } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } }
  return <main className={`flex flex-col items-center gap-3 p-4 ${pinned.length ? "pt-6" : "min-h-screen justify-center"}`}>
    {pinned.length > 0 && <div className="w-full max-w-sm space-y-3" data-testid="cp-pickups">
      {pinned.map(x => <PickupConfirmCard key={x.id} r={x} onDone={(m, ok) => { if (ok) keep(x.id); setPmsg(ok ? "" : m); parentFeed().then(y => setFeed(y.items)).catch(() => {}) }} />)}
      {pmsg && <p className="rounded-2xl bg-mint-100 p-3 text-sm text-mint-700" data-testid="pickup-msg">{pmsg}</p>}
      <h2 className="pt-2 text-sm font-semibold text-ink-500" data-testid="cp-then">Sau đó, đặt mật khẩu mới</h2></div>}
    {back && <div className="w-full max-w-sm"><button type="button" className="min-h-12 text-[15px] text-mint-700" data-testid="cp-back"
      onClick={() => r.push(back)}>‹ {back === "/account" ? "Tài khoản" : "Quay lại"}</button></div>}
    <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
    <h1 className="text-xl font-bold">Đổi mật khẩu</h1>{me?.mustChangePassword && <p className="rounded-xl bg-sun-100 p-3 text-sm">Đây là lần đầu bạn đăng nhập, vui lòng đặt mật khẩu mới để tiếp tục.</p>}
    <input className="input" type="password" placeholder="Mật khẩu hiện tại" value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" required />
    <input className="input" type="password" placeholder="Mật khẩu mới" value={nw} onChange={e => setNw(e.target.value)} autoComplete="new-password" required />
    {nw && <div><div className="flex gap-1">{[1, 2, 3, 4].map(i => <div key={i} className={`h-2 flex-1 rounded-full ${i <= s ? LV[s][0] : "bg-ink-100"}`} />)}</div><p className="mt-1 text-xs text-ink-500">Độ mạnh: {LV[s][1]}</p></div>}
    <input className="input" type="password" placeholder="Nhập lại mật khẩu mới" value={cf} onChange={e => setCf(e.target.value)} autoComplete="new-password" required />
    {err && <p role="alert" className="text-sm text-rose-500">{err}</p>}<button className="btn w-full" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu mới"}</button></form></main>;
}
