"use client";
import { useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
import { http } from "@/lib/api"; import { monthLabel, vnd } from "@/lib/fmt"; import { PrintDoc, Receipt, method, when } from "../print";
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>(); const [r, setR] = useState<Receipt | null>(null); const [err, setErr] = useState("");
  useEffect(() => { http.get<Receipt>(`/payments/${id}/receipt`).then(setR).catch(e => setErr((e as { code?: number }).code === 404 ? "Không có biên lai: khoản này được miễn/giảm 100% hoặc không phát sinh tiền thu." : e.message)) }, [id]);
  if (err) return <p className="text-rose-500">{err}</p>; if (!r) return <p>Đang tải…</p>;
  const content = r.invoice ? `Học phí ${monthLabel(r.invoice.period).toLowerCase()} (HĐ ${r.invoice.invoiceNo})` : "Trả trước học phí";
  return <div className="space-y-4">
    <div className="no-print flex flex-wrap gap-2 print:hidden"><Link href={r.invoice ? `/fees/invoice/${r.invoice.id}` : `/fees/child/${r.child.id}`} className="btn !bg-white !text-ink-700">‹ Quay lại</Link><button className="btn" onClick={() => window.print()} data-testid="btn-print">🖨 In biên lai</button></div>
    <PrintDoc school={r.school} title="BIÊN LAI THU TIỀN" no={r.receiptNo} amount={r.amount} words={r.amountInWords} left="Người nộp" right="Kế toán" rightName={r.receivedByName}
      rows={[["Họ tên bé", <><b key="n">{r.child.fullName}</b>{r.child.className ? ` · Lớp ${r.child.className}` : ""}</>], ["Nội dung", content], ["Người nộp", r.payerName || "—"], ["Hình thức", method(r.method)], ["Ngày thu", when(r.paidAt)],
        ...(r.creditAdded > 0 ? [["Vào số dư", `${vnd(r.creditAdded)} (số dư hiện tại ${vnd(r.currentCreditBalance)})`] as [string, string]] : []),
        ...(r.invoice ? [["Còn nợ HĐ", vnd(r.invoice.balanceAfter)] as [string, string]] : [])]} /></div>;
}
