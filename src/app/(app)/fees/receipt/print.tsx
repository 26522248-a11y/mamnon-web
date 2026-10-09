"use client";
import { vnd, vnDateTime } from "@/lib/fmt"; import { useSchool } from "@/lib/school"; import { METHOD } from "../types";
type School = { name: string | null; address: string | null; phone: string | null };
export type Receipt = { school: School; receiptNo: string; paymentId: string; paidAt: string; method: string; payerName: string | null; amount: number; amountInWords: string; appliedToInvoice: number; creditAdded: number; currentCreditBalance: number; note: string | null; receivedByName: string | null; kind: string;
  child: { id: string; fullName: string; className: string | null }; invoice: { id: string; invoiceNo: string; period: string; balanceAfter: number } | null };
export type Voucher = { school: School; title: string; voucherNo: string; payoutId: string; paidAt: string; method: string; recipientName: string; amount: number; amountInWords: string; reason: string; note: string | null; paidByName: string | null; creditBalanceAfter: number; child: { id: string; fullName: string; className: string | null; leaveDate: string | null } };
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex gap-2 py-0.5"><span className="w-28 shrink-0 text-ink-500">{k}</span><span>{v}</span></div>;
export function PrintDoc({ school, title, no, rows, amount, words, left, right, rightName }: { school: School; title: string; no: string; rows: [string, React.ReactNode][]; amount: number; words: string; left: string; right: string; rightName?: string | null }) {
  // Ưu tiên GET /settings/school; thiếu trường nào thì dùng thông tin kèm theo biên lai; không có thì ẩn
  const st = useSchool(); const sc = { name: st?.name || school?.name || null, address: st?.address || school?.address || null, phone: st?.phone || school?.phone || null };
  return <div className="print-a5 mx-auto max-w-md rounded-3xl border-t-8 border-mint-500 bg-white p-6 text-sm shadow-card" data-testid="print-doc">
    <div className="text-center">{sc.name && <div className="font-bold uppercase" data-testid="print-school-name">{sc.name}</div>}{(sc.address || sc.phone) && <div className="text-xs text-ink-500" data-testid="print-school-contact">{[sc.address, sc.phone && `ĐT: ${sc.phone}`].filter(Boolean).join(" · ")}</div>}
      <h1 className="mt-3 text-xl font-bold text-mint-700">{title}</h1><div className="text-xs">Số: {no}</div></div>
    <div className="mt-4">{rows.map(([k, v]) => <Row key={k} k={k} v={v} />)}<Row k="Số tiền" v={<b className="amount" data-testid="print-amount">{vnd(amount)}</b>} /><Row k="Bằng chữ" v={<i data-testid="print-words">{words}</i>} /></div>
    <div className="signatures mt-6 grid grid-cols-2 text-center text-xs"><div>{left}<div className="mt-12">………………</div></div><div>{right}<div className="mt-12">{rightName || "………………"}</div></div></div></div>;
}
export const method = (m: string) => METHOD[m] ?? m; export const when = vnDateTime;
