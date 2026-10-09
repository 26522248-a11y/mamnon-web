"use client";
/** B18 (mockups8): admin-only, read-only history of sensitive changes — guardian unlink, phone change, photo consent change. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateField } from "@/components/DateField";
import { api, todayStr } from "@/lib/api";
import { fmtDate } from "@/lib/date";
import { exportSensitiveCsv, listSensitive, maskIp, SensitiveCounts, SensitiveItem, SensitiveType, TYPE_UI, TYPES } from "@/lib/sensitive-api";

const LIMIT = 20;
const TZ = "Asia/Ho_Chi_Minh";
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE") };
const vnDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dm = (iso: string) => { const [, m, d] = vnDay(iso).split("-"); return `${d}/${m}` };
const EMPTY = "Chưa có thay đổi nào trong khoảng này";

function Actor({ i }: { i: SensitiveItem }) {
  const who = i.actor.username ?? i.actor.name ?? "Hệ thống";
  return <>{who}{i.actor.self && " (tự sửa)"}</>;
}

export default function SensitiveChangesPage() {
  const me = api.me();
  const [f, setF] = useState<{ type: SensitiveType | ""; from: string; to: string }>({ type: "", from: addDays(todayStr(), -8), to: todayStr() });
  const [q, setQ] = useState(""); const [qDebounced, setQDebounced] = useState(""); const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SensitiveItem[] | null>(null); const [total, setTotal] = useState(0); const [counts, setCounts] = useState<SensitiveCounts | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQDebounced(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q]);
  const query = useMemo(() => ({ type: f.type, from: f.from || undefined, to: f.to || undefined, q: qDebounced || undefined }), [f, qDebounced]);
  const load = useCallback(() => {
    setErr("");
    listSensitive({ ...query, page, limit: LIMIT }).then(r => { setRows(r.items); setTotal(r.total); setCounts(r.counts) })
      .catch(e => { setErr((e as { code?: number }).code === 404 ? "Máy chủ chưa có API lịch sử thay đổi (GET /audit/sensitive)." : (e as Error).message); setRows([]) });
  }, [query, page]);
  useEffect(() => { if (me?.role === "admin") load() }, [load, me?.role]);
  const groups = useMemo(() => {
    const out: { day: string; items: SensitiveItem[] }[] = [];
    for (const i of rows ?? []) { const d = vnDay(i.createdAt); const g = out[out.length - 1]; if (g?.day === d) g.items.push(i); else out.push({ day: d, items: [i] }) }
    return out;
  }, [rows]);
  if (me?.role !== "admin") return <p className="text-ink-500">Chỉ Ban giám hiệu xem lịch sử thay đổi.</p>;
  const upd = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setPage(1) };
  const dayLabel = (d: string) => d === todayStr() ? "HÔM NAY" : d === addDays(todayStr(), -1) ? "HÔM QUA" : fmtDate(d);
  const csv = async () => { setBusy(true); setErr(""); try { await exportSensitiveCsv(query) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  const chip = (t: SensitiveType | "", label: string, short: string, n: number | undefined, cls: string) =>
    <button key={t || "all"} onClick={() => upd({ type: t })} aria-pressed={f.type === t} data-testid={`sc-chip-${t || "all"}`}
      className={`min-h-10 shrink-0 rounded-full px-3 py-1.5 text-xs ${f.type === t ? (t ? `${cls} font-semibold ring-2 ring-current` : "bg-mint-500 font-semibold text-white") : t ? cls : "bg-ink-100 text-ink-700"}`}>
      <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>{n !== undefined && <span className="hidden sm:inline"> · {n}</span>}</button>;

  return <div className="mx-auto max-w-5xl space-y-4" data-testid="sensitive-changes-page">
    <div className="flex items-center justify-between gap-2">
      <div><p className="text-xs text-ink-500">Quản trị · Bảo mật</p><h1 className="text-2xl font-bold">Lịch sử thay đổi</h1></div>
      <button className="min-h-11 shrink-0 rounded-xl border border-ink-100 bg-white px-4 text-sm font-semibold disabled:opacity-50" onClick={csv} disabled={busy || !total} data-testid="sc-export">⬇ Xuất CSV</button>
    </div>
    <div className="card space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input min-w-0" placeholder="🔍 Tìm tên bé, phụ huynh, người sửa…" value={q} onChange={e => setQ(e.target.value)} data-testid="sc-search" />
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <DateField className="min-w-0" value={f.from} max={f.to || undefined} onChange={v => upd({ from: v })} aria-label="Từ ngày" data-testid="sc-from" />
          <DateField className="min-w-0" value={f.to} min={f.from || undefined} onChange={v => upd({ to: v })} aria-label="Đến ngày" data-testid="sc-to" /></div>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="sc-chips">
        {chip("", "Tất cả", "Tất cả", counts?.all, "")}
        {TYPES.map(t => chip(t, `${TYPE_UI[t].icon} ${TYPE_UI[t].chip}`, `${TYPE_UI[t].icon} ${TYPE_UI[t].short}`, counts?.[t], TYPE_UI[t].pill))}
      </div>
    </div>
    {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
    {rows === null && <p className="text-ink-500">Đang tải…</p>}
    {rows?.length === 0 && !err && <div className="card py-10 text-center text-ink-500" data-testid="sc-empty">🗂️<p className="mt-2">{EMPTY}</p></div>}

    {!!rows?.length && <>
      {/* desktop / tablet: table */}
      <div className="card hidden overflow-x-auto md:block" data-testid="sc-table">
        <table className="w-full text-sm"><thead className="text-left text-xs text-ink-500"><tr><th className="py-2">Thời gian</th><th>Loại</th><th>Đối tượng</th><th>Trước → Sau</th><th>Người sửa</th></tr></thead>
          <tbody className="divide-y divide-ink-100">{rows.map(i => { const ui = TYPE_UI[i.type]; return <tr key={i.id} className={`align-top ${ui.row}`} data-testid="sc-row">
            <td className="whitespace-nowrap py-3 pr-2">{dm(i.createdAt)} {hm(i.createdAt)}</td>
            <td className="py-3 pr-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${ui.pill}`}>{ui.icon} {ui.chip}</span></td>
            <td className="py-3 pr-2">{i.target.label ?? "—"}</td>
            <td className="py-3 pr-2">{i.beforeText} → <b>{i.afterText}</b>{i.reason && <p className="mt-1 text-xs text-ink-500">Lý do: {i.reason}</p>}</td>
            <td className="py-3"><Actor i={i} />{maskIp(i.ip) && <><br /><span className="text-xs text-ink-500">IP {maskIp(i.ip)}</span></>}</td></tr> })}</tbody></table>
      </div>
      {/* mobile 390px: cards by day, coloured left border */}
      <div className="space-y-3 md:hidden" data-testid="sc-cards">{groups.map(g => <div key={g.day} className="space-y-2">
        <p className="px-1 text-xs font-semibold text-ink-500">{dayLabel(g.day)}</p>
        {g.items.map(i => { const ui = TYPE_UI[i.type]; return <div key={i.id} className={`min-w-0 rounded-2xl border-l-4 bg-white p-3 text-sm shadow-card ${ui.border}`} data-testid="sc-card">
          <div className="flex justify-between gap-2"><b className="min-w-0">{ui.icon} {ui.long}</b><span className="shrink-0 text-xs text-ink-500">{hm(i.createdAt)}</span></div>
          <p className="mt-1 break-words">{i.target.label ?? "—"}</p>
          <p className="mt-1 break-words text-xs"><s className="text-ink-500">{i.beforeText}</s> → <b>{i.afterText}</b></p>
          {i.reason && <p className="mt-1 break-words text-xs text-ink-500">Lý do: {i.reason}</p>}
          <p className="mt-1 text-xs text-ink-500">bởi <Actor i={i} /></p></div> })}</div>)}</div>
      <p className="text-xs text-ink-500">🔒 SĐT được che giữa. Chỉ xem, không sửa / xoá được. Hiển thị {rows.length}/{total}.</p>
    </>}

    {total > LIMIT && <div className="flex items-center justify-center gap-2">
      <button className="btn min-h-12 !bg-white !text-ink-700" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước">‹</button>
      <span className="text-sm">Trang {page}/{Math.ceil(total / LIMIT)}</span>
      <button className="btn min-h-12 !bg-white !text-ink-700" disabled={page * LIMIT >= total} onClick={() => setPage(page + 1)} aria-label="Trang sau">›</button></div>}
  </div>;
}
