/** Thu chi tổng (mockups9). Backend: /finance/* (chỉ BGH + kế toán). Kiểu dữ liệu giữ nguyên như bản thiết kế. */
import { http, todayStr } from "./api";

export type Txn = { id: string; date: string; title: string; amount: number; kind: "in" | "out"; by?: string; auto?: boolean; hasReceipt?: boolean; pending?: boolean;
  status?: "approved" | "pending" | "rejected" | "void"; category?: string; receiptUrl?: string | null };
export type Finance = { month: string; totalIn: number; totalOut: number; prevDiffPct: number; inBreakdown: string; outBreakdown: string; groups: { name: string; amount: number }[]; txns: Txn[];
  pending?: { count: number; amount: number } };
export type Category = { id: string; kind: "in" | "out"; name: string };
export const APPROVAL_LIMIT = 10_000_000;

type ApiSummary = { month: string; totalIn: number; totalOut: number; net: number; in: { fees: number; other: number }; outGroups: { name: string; amount: number }[];
  change: { netPct: number | null }; pending: { count: number; amount: number } };
type ApiTxn = { id: string; date: string; title: string; amount: number; kind: "in" | "out"; auto: boolean; status: Txn["status"]; hasReceipt: boolean; receiptUrl?: string | null;
  category: { name: string | null }; createdBy?: { username: string; name: string } | null };

const tr = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr";

export async function getFinance(month?: string): Promise<Finance> {
  const m = month || todayStr().slice(0, 7);
  const [s, t] = await Promise.all([http.get<ApiSummary>(`/finance/summary?month=${m}`), http.get<{ items: ApiTxn[] }>(`/finance/transactions?month=${m}`)]);
  const top = s.outGroups.slice(0, 2).map(g => `${g.name.split(" ")[0]} ${tr(g.amount)}`);
  return {
    month: s.month, totalIn: s.totalIn, totalOut: s.totalOut, prevDiffPct: s.change.netPct ?? 0, pending: s.pending,
    inBreakdown: `Học phí ${tr(s.in.fees)} · Khác ${tr(s.in.other)}`,
    outBreakdown: top.length ? top.join(" · ") + (s.outGroups.length > 2 ? " · Khác" : "") : "Chưa có khoản chi",
    groups: s.outGroups,
    txns: t.items.map(x => ({ id: x.id, date: x.date, title: x.title, amount: x.amount, kind: x.kind, auto: x.auto, by: x.createdBy?.username, hasReceipt: x.hasReceipt,
      pending: x.status === "pending", status: x.status, category: x.category?.name ?? undefined, receiptUrl: x.receiptUrl })),
  };
}
export const getCategories = async () => (await http.get<{ items: Category[] }>("/finance/categories")).items;
export function createEntry(f: { kind: "in" | "out"; date: string; title: string; amount: number; categoryId: string; note?: string }, receipt?: File | null) {
  const fd = new FormData();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && fd.append(k, String(v)));
  if (receipt) fd.append("receipt", receipt);
  return http.upload<{ id: string; status: string }>("/finance/entries", fd);
}
export const decideEntry = (id: string, action: "approve" | "reject" | "void", note?: string) => http.post(`/finance/entries/${id}/${action}`, { note });
export const openReceipt = async (url: string) => { const w = window.open("", "_blank"); const u = await http.blobUrl(url); if (w && u) w.location.href = u; else w?.close() };
