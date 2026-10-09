export type InvStatus = "unpaid" | "partial" | "paid" | "void";
export interface Line { id: string; feeItemId: string | null; kind: "charge" | "discount" | "refund" | string; description: string; quantity: number; unitPrice: number; amount: number; reason: string | null }
export interface Payment { id: string; receiptNo: string; amount: number; creditAmount: number; method: "cash" | "transfer"; paidAt: string; payerName: string | null; note: string | null; receivedByName?: string }
export interface Invoice { id: string; invoiceNo: string; childId: string; childName: string; classId: string; className: string | null; period: string; issueDate: string; dueDate: string; totalAmount: number; paidAmount: number; balance: number; status: InvStatus; note: string | null; overdue: boolean; waived?: boolean; lines?: Line[]; payments?: Payment[]; warnings?: Warning[];
  /** round3 §1.3: separate from status/debt (QR-10) */ paymentStatus?: "pending_confirmation" | null; transferClaim?: import("@/lib/fees-api").TransferClaim | null;
  /** TODO(fees-api) not in round3 contract: per-day absence breakdown (refunded or not) */ absenceDays?: { date: string; refundEligible: boolean; amount?: number; reportedAt?: string | null }[] }
export interface Warning { code: string; message: string }
export interface DebtRow { childId: string; fullName: string; className: string; classId: string; childStatus: string; leaveDate: string | null; balance: number; invoiceCount: number; oldestDueDate: string; overdueAmount: number; overdueInvoiceCount: number; creditBalance: number; overdue: boolean }
export interface Debts { asOf: string; overdueRule: string; totalDebt: number; totalOverdue: number; childCount: number; overdueChildCount: number; items: DebtRow[] }
export interface Balance { childId: string; fullName: string; className: string; totalInvoiced: number; totalPaid: number; balance: number; creditBalance: number; netBalance: number; overdueAmount: number; outstanding: Invoice[] }
export const STATUS: Record<string, [string, string]> = { paid: ["bg-mint-100 text-mint-700", "Đã đóng"], partial: ["bg-sun-100 text-ink-900", "Đóng một phần"], unpaid: ["bg-peach-100 text-peach-600", "Chưa đóng"], void: ["bg-ink-100 text-ink-500", "Đã hủy"], overdue: ["bg-rose-100 text-rose-500", "⚠ Quá hạn"] };
export const METHOD: Record<string, string> = { cash: "Tiền mặt", transfer: "Chuyển khoản" };
/** Hóa đơn 0đ đã "thanh toán" = được miễn/giảm 100%, không có tiền thu nên không có biên lai. */
export const isWaived = (inv: Pick<Invoice, "status"> & { totalAmount?: number; waived?: boolean }) => !!inv.waived || (inv.status === "paid" && inv.totalAmount === 0);
export function StatusPill({ inv }: { inv: Pick<Invoice, "status" | "overdue"> & { totalAmount?: number; waived?: boolean; paymentStatus?: Invoice["paymentStatus"] } }) {
  if (inv.paymentStatus === "pending_confirmation" && inv.status !== "paid" && inv.status !== "void") return <span className="whitespace-nowrap rounded-full bg-sun-100 px-3 py-1 text-xs font-semibold text-ink-900" data-testid="pill-transfer-pending">⏳ Chờ kế toán xác nhận</span>;
  if (isWaived(inv)) return <span className="whitespace-nowrap rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-500" data-testid="pill-waived">Miễn/giảm 100%</span>;
  const [c, l] = inv.overdue && inv.status !== "paid" && inv.status !== "void" ? STATUS.overdue : STATUS[inv.status] ?? STATUS.unpaid;
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${c}`}>{l}</span>;
}
