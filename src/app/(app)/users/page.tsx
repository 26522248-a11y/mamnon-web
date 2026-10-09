"use client";
// Quản lý tài khoản (designer) – theo mockups4.html. Chỉ admin.
import { useCallback, useEffect, useState } from "react";
import { http } from "@/lib/api";
type Role = "admin" | "teacher" | "accountant" | "parent";
type U = { id: string; username: string; name: string; role: Role; phone: string | null; isActive: boolean; mustChangePassword: boolean; locked: boolean; lockedUntil: string | null; classIds: string[]; childIds: string[] };
const ROLE: Record<Role, { label: string; cls: string }> = {
  admin: { label: "Ban giám hiệu", cls: "bg-ink-100 text-ink-900" },
  teacher: { label: "Giáo viên", cls: "bg-mint-100 text-mint-700" },
  accountant: { label: "Kế toán", cls: "bg-sky-100 text-sky-500" },
  parent: { label: "Phụ huynh", cls: "bg-peach-100 text-peach-500" },
};
const hhmm = (s: string) => new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

export default function UsersPage() {
  const [rows, setRows] = useState<U[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [role, setRole] = useState<"" | Role>(""); const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false); const [resetFor, setResetFor] = useState<U | null>(null);
  const limit = 20;
  const load = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit), ...(role ? { role } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
    const r = await http.get<{ items: U[]; total: number }>("/users?" + q); setRows(r.items); setTotal(r.total);
  }, [page, role, search]);
  useEffect(() => { const t = setTimeout(() => load().catch(e => setMsg({ ok: false, text: e.message })), 250); return () => clearTimeout(t) }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  };
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Tài khoản</h1>
      <button onClick={() => setCreating(true)} className="h-12 rounded-xl bg-mint-500 px-5 font-semibold text-white shadow">+ Tạo tài khoản</button>
    </div>
    <div className="flex flex-wrap gap-2">
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="🔍 Tìm tên, tên đăng nhập, SĐT…" className="h-12 w-full rounded-xl bg-white px-4 md:w-72" />
      {(["", "admin", "teacher", "accountant", "parent"] as const).map(r =>
        <button key={r} onClick={() => { setRole(r); setPage(1) }} className={`h-12 rounded-xl px-4 text-sm ${role === r ? "bg-mint-500 text-white" : "bg-white"}`}>{r ? ROLE[r].label : "Tất cả"}</button>)}
    </div>
    {msg && <div role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-mint-50 text-mint-700" : "bg-rose-100 text-rose-500"}`}>{msg.text}</div>}
    <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className="text-left text-ink-500"><th className="py-2">Tên</th><th>Vai trò</th><th>Liên kết</th><th>Trạng thái</th><th className="text-right">Thao tác</th></tr></thead>
        <tbody>{rows.map(u => <tr key={u.id} data-testid="user-row" className={`border-t ${u.locked ? "bg-rose-100/40" : ""} ${!u.isActive ? "opacity-60" : ""}`}>
          <td className="py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-ink-500">@{u.username}{u.phone ? ` · ${u.phone}` : ""}</div></td>
          <td><span className={`rounded-full px-2 py-1 text-xs ${ROLE[u.role].cls}`}>{ROLE[u.role].label}</span></td>
          <td className="text-ink-500">{u.role === "teacher" ? `${u.classIds.length} lớp` : u.role === "parent" ? `${u.childIds.length} bé` : "–"}</td>
          <td>{u.locked && u.lockedUntil ? <span className="text-rose-500">🔒 Bị khóa đến {hhmm(u.lockedUntil)}</span>
            : !u.isActive ? <span className="text-ink-500">⏸ Ngưng hoạt động</span>
            : u.mustChangePassword ? <span className="text-amber-600">🔑 Chờ đổi mật khẩu</span>
            : <span className="text-mint-700">🟢 Hoạt động</span>}</td>
          <td className="space-x-3 whitespace-nowrap text-right">
            {u.locked && <button disabled={busy} onClick={() => act(() => http.post(`/users/${u.id}/unlock`), `Đã mở khóa ${u.name}`)} className="font-semibold text-mint-700">Mở khóa</button>}
            <button disabled={busy} onClick={() => setResetFor(u)} className="text-ink-500 hover:text-ink-900">Đặt lại MK</button>
            {u.isActive
              ? <button disabled={busy} onClick={() => confirm(`Ngưng hoạt động tài khoản ${u.name}?`) && act(() => http.post(`/users/${u.id}/deactivate`), `Đã ngưng ${u.name}`)} className="text-rose-500">Ngưng</button>
              : <button disabled={busy} onClick={() => act(() => http.post(`/users/${u.id}/activate`), `Đã kích hoạt ${u.name}`)} className="text-mint-700">Kích hoạt</button>}
          </td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="py-10 text-center text-ink-500">Không có tài khoản phù hợp</td></tr>}
        </tbody></table>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-500"><span>{total} tài khoản</span>
        <div className="space-x-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg bg-ink-100 px-3 py-2 disabled:opacity-40">‹</button><span>{page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg bg-ink-100 px-3 py-2 disabled:opacity-40">›</button></div></div>
    </div>
    {creating && <CreateDialog onClose={() => setCreating(false)} onDone={n => { setCreating(false); setMsg({ ok: true, text: `Đã tạo tài khoản ${n}. Người dùng sẽ phải đổi mật khẩu khi đăng nhập lần đầu.` }); load() }} />}
    {resetFor && <ResetDialog u={resetFor} onClose={() => setResetFor(null)} onDone={() => { setMsg({ ok: true, text: `Đã đặt lại mật khẩu cho ${resetFor.name} và mở khóa nếu đang bị khóa.` }); setResetFor(null); load() }} />}
  </div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 md:items-center" onClick={onClose}>
    <div role="dialog" aria-label={title} onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl bg-cream p-6 md:rounded-3xl">
      <h2 className="text-xl font-bold">{title}</h2>{children}</div></div>;
}
const inp = "h-12 w-full rounded-xl border bg-white px-4";
function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [f, setF] = useState({ name: "", username: "", password: "", phone: "", role: "teacher" as Role }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr("");
    try { await http.post("/users", { ...f, phone: f.phone || undefined }); onDone(f.name) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } };
  return <Modal title="Tạo tài khoản" onClose={onClose}><form onSubmit={submit} className="space-y-3">
    <input required placeholder="Họ tên" value={f.name} onChange={set("name")} className={inp} />
    <input required placeholder="Tên đăng nhập (a-z, 0-9)" pattern="[a-z0-9_.]{3,64}" value={f.username} onChange={set("username")} className={inp} />
    <input required minLength={6} placeholder="Mật khẩu tạm (≥ 6 ký tự)" value={f.password} onChange={set("password")} className={inp} />
    <input placeholder="Số điện thoại" value={f.phone} onChange={set("phone")} className={inp} />
    <select value={f.role} onChange={set("role")} className={inp}>{(Object.keys(ROLE) as Role[]).map(r => <option key={r} value={r}>{ROLE[r].label}</option>)}</select>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border-2 border-mint-500 font-semibold text-mint-700">Hủy</button><button disabled={busy} className="h-12 flex-1 rounded-xl bg-mint-500 font-semibold text-white disabled:opacity-50">Tạo</button></div>
  </form></Modal>;
}
function ResetDialog({ u, onClose, onDone }: { u: U; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr("");
    try { await http.post(`/users/${u.id}/reset-password`, { newPassword: pw }); onDone() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) } };
  return <Modal title={`Đặt lại mật khẩu · ${u.name}`} onClose={onClose}><form onSubmit={submit} className="space-y-3">
    <p className="text-sm text-ink-500">Người dùng sẽ bị đăng xuất và phải đổi mật khẩu ở lần đăng nhập tới.</p>
    <input required minLength={6} placeholder="Mật khẩu tạm mới" value={pw} onChange={e => setPw(e.target.value)} className={inp} />
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border-2 border-mint-500 font-semibold text-mint-700">Hủy</button><button disabled={busy} className="h-12 flex-1 rounded-xl bg-peach-500 font-semibold text-white disabled:opacity-50">Đặt lại</button></div>
  </form></Modal>;
}
