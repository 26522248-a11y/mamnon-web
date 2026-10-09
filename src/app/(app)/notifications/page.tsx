"use client";
import { useCallback, useEffect, useState } from "react"; import { useRouter } from "next/navigation"; import { api, http } from "@/lib/api"; import { vnDateTime } from "@/lib/fmt";
type N = { id: string; type: string; title: string; body: string; data: Record<string, unknown> | null; important?: boolean; announcementId: string | null; read: boolean; readAt: string | null; createdAt: string };
type Page = { items: N[]; total: number; unreadCount: number; importantUnreadCount?: number };
const STYLE: Record<string, [string, string]> = { pickup_request: ["border-rose-500", "🚸"], pickup_decision: ["border-sun-500", "✅"], picked_up: ["border-mint-500", "🏠"], contact_change: ["border-sun-500", "📞"], invoice: ["border-peach-500", "💰"], announcement: ["border-mint-500", "📣"] };
const isImp = (n: N) => !!(n.important || n.data?.important || n.data?.isImportant);
function ago(iso: string) { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : vnDateTime(iso) }
export default function Inbox() {
  const router = useRouter(); const me = api.me(); const [tab, setTab] = useState<"all" | "unread">("all"); const [d, setD] = useState<Page | null>(null); const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => http.get<Page>(`/notifications?limit=50${tab === "unread" ? "&unreadOnly=true" : ""}`).then(setD).catch(() => {}), [tab]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load]);
  async function click(n: N) {
    if (!n.read) { await http.post(`/notifications/${n.id}/read`).catch(() => {}); load() }
    const x = (n.data ?? {}) as Record<string, string>;
    if (n.type === "invoice" && x.invoiceId && me?.role !== "teacher") return router.push(`/fees/invoice/${x.invoiceId}`);
    if (n.type === "pickup_request" && x.pickupRequestId && me?.role === "parent") return router.push(`/today?req=${x.pickupRequestId}`);
    if (n.type === "picked_up" && me?.role === "parent") return router.push("/today");
    if (n.type === "contact_change" && x.childId) return router.push(`/children/${x.childId}`);
    if (n.type.startsWith("pickup") && x.childId) return router.push(me?.role === "parent" ? "/today" : `/children/${x.childId}`);
    setOpen(open === n.id ? null : n.id);
  }
  // Ghim: yêu cầu đón chưa đọc trên cùng, rồi tin quan trọng chưa đọc
  const rank = (n: N) => (n.type === "pickup_request" && !n.read ? 2 : 0) + (isImp(n) && !n.read ? 1 : 0);
  const items = [...(d?.items ?? [])].sort((a, b) => rank(b) - rank(a));
  return <div className="mx-auto max-w-2xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">🔔 Thông báo {!!d?.importantUnreadCount && <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.5 align-middle text-sm text-white" data-testid="important-unread">{d.importantUnreadCount} quan trọng</span>}</h1>
      {!!d?.unreadCount && <button className="min-h-12 px-2 text-sm text-mint-700" onClick={async () => { await http.post("/notifications/read-all"); load() }} data-testid="btn-read-all">Đánh dấu đã đọc tất cả</button>}</div>
    <div className="flex gap-2"><button className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${tab === "all" ? "bg-mint-500 text-white" : "bg-white"}`} onClick={() => setTab("all")} data-testid="tab-all">Tất cả</button>
      <button className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${tab === "unread" ? "bg-mint-500 text-white" : "bg-white"}`} onClick={() => setTab("unread")} data-testid="tab-unread">Chưa đọc ({d?.unreadCount ?? 0})</button></div>
    {items.map(n => { const [b0, ic] = STYLE[n.type] ?? ["border-ink-300", "🔔"]; const b = isImp(n) && n.type === "announcement" ? "border-rose-500 bg-rose-100/30" : b0;
      return <button key={n.id} onClick={() => click(n)} data-testid="notif-item" data-type={n.type} data-read={n.read} data-important={isImp(n)} className={`card block w-full border-l-4 text-left ${b} ${n.read ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between gap-2"><b className={n.read ? "font-medium" : ""}>{isImp(n) && <span className="mr-1 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white" data-testid="notif-important">Quan trọng</span>}{ic} {n.title}</b>{!n.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-peach-500" aria-label="Chưa đọc" />}</div>
        <div className={`text-sm text-ink-700 ${open === n.id ? "whitespace-pre-line" : "line-clamp-2"}`}>{n.body}</div><div className="mt-1 text-xs text-ink-500">{ago(n.createdAt)}</div></button> })}
    {d && items.length === 0 && <p className="py-8 text-center text-ink-500">{tab === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo"}</p>}</div>;
}
