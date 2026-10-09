"use client";
import { useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
import { http } from "@/lib/api"; import { vnDate } from "@/lib/fmt"; import { PrintDoc, Voucher, method, when } from "../../print";
export default function VoucherPage() {
  const { id } = useParams<{ id: string }>(); const [v, setV] = useState<Voucher | null>(null); const [err, setErr] = useState("");
  useEffect(() => { http.get<Voucher>(`/refund-payouts/${id}/voucher`).then(setV).catch(e => setErr(e.message)) }, [id]);
  if (err) return <p className="text-rose-500">{err}</p>; if (!v) return <p>Đang tải…</p>;
  return <div className="space-y-4">
    <div className="no-print flex flex-wrap gap-2 print:hidden"><Link href={`/fees/child/${v.child.id}`} className="btn !bg-white !text-ink-700">‹ Quay lại</Link><button className="btn" onClick={() => window.print()} data-testid="btn-print">🖨 In phiếu chi</button></div>
    <PrintDoc school={v.school} title={v.title || "PHIẾU CHI"} no={v.voucherNo} amount={v.amount} words={v.amountInWords} left="Người nhận" right="Kế toán" rightName={v.paidByName}
      rows={[["Họ tên bé", <><b key="n">{v.child.fullName}</b>{v.child.className ? ` · Lớp ${v.child.className}` : ""}{v.child.leaveDate ? ` · nghỉ từ ${vnDate(v.child.leaveDate)}` : ""}</>], ["Người nhận", v.recipientName], ["Lý do chi", v.reason], ["Hình thức", method(v.method)], ["Ngày chi", when(v.paidAt)], ...(v.note ? [["Ghi chú", v.note] as [string, string]] : [])]} /></div>;
}
