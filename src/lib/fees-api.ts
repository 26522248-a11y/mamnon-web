/**
 * Wave 3 · QR tuition payment — /workspace/mamnon-backend/docs/round3-api.md §1 (4e060e9, contract only, not implemented yet).
 * feeFeatures() gates the UI via Swagger ("Sắp có" until live). "Tôi đã chuyển" only creates a claim: the invoice keeps
 * status unpaid|partial and gains paymentStatus 'pending_confirmation' (separate from paid/debt, QR-10). Never mark paid client-side.
 */
import { API_ORIGIN, http, softGet } from "@/lib/api";

// ── QR (§1.2) ──
export type ClaimStatus = "pending_confirmation" | "confirmed" | "rejected";
export type TransferClaim = {
  id: string; status: ClaimStatus; childId: string; childName: string; className: string | null; invoiceId: string; invoiceNo: string;
  amountDue?: number; amount: number; /** = amount - amountDue */ difference?: number; transferredAt: string | null; claimedAt: string;
  claimedBy: { id: string; name: string } | null; onBehalf?: boolean; note?: string | null;
  decidedAt: string | null; decidedBy: { id: string; name: string } | string | null; rejectReason: string | null; paymentId: string | null; receiptNo: string | null;
};
export type InvoiceQr = {
  invoiceId: string; invoiceNo: string; /** still owed */ amount: number; /** = invoiceNo */ transferContent: string;
  bank: { bin: string; accountNo: string; accountName: string }; /** EMVCo VietQR string → rendered client-side */ payload: string;
  /** non-production sample account: never transfer */ sample: boolean; pendingClaim: TransferClaim | null;
};
/** 403 other child · 404 · 409 INVOICE_VOID / ALREADY_PAID / ZERO_INVOICE · 409 BANK_ACCOUNT_NOT_CONFIGURED (production, details.schoolPhone). */
export const getInvoiceQr = (invoiceId: string) => http.get<InvoiceQr>(`/invoices/${invoiceId}/qr`);

/** NAPAS BIN → short bank name (display only; the QR payload carries the BIN). */
const BANKS: Record<string, string> = { "970436": "Vietcombank", "970415": "VietinBank", "970418": "BIDV", "970405": "Agribank", "970422": "MB Bank",
  "970407": "Techcombank", "970416": "ACB", "970432": "VPBank", "970423": "TPBank", "970403": "Sacombank", "970437": "HDBank", "970441": "VIB", "970443": "SHB", "970448": "OCB" };
export const bankName = (bin: string) => BANKS[bin] ?? `Ngân hàng (mã ${bin})`;

// ── transfer claims (§1.3) ──
/** Parent (own child). Idempotent: an existing pending claim comes back with 200 (QR-06). */
export const claimTransfer = (invoiceId: string, b: { amount?: number; transferredAt?: string; note?: string } = {}) =>
  http.post<TransferClaim>(`/invoices/${invoiceId}/transfer-claims`, b);
const unwrap = <T,>(r: T[] | { items?: T[] } | null | undefined): T[] => Array.isArray(r) ? r : r?.items ?? [];
/** Admin, accountant: reconciliation table (pending first, oldest first). */
export const listClaims = (q: { status?: ClaimStatus; classId?: string; period?: string } = { status: "pending_confirmation" }) =>
  http.get<{ items: TransferClaim[] }>(`/transfer-claims?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`).then(unwrap);
export type Receipt = { id?: string; paymentId?: string; receiptNo: string; amount: number };
/** amount = actually received (default claim amount): shortfall → partial, excess → child credit (QR-09). 409 CLAIM_ALREADY_DECIDED / ALREADY_PAID / INVOICE_VOID. */
export const confirmClaim = (id: string, amount: number, note?: string) =>
  http.post<{ claim: TransferClaim; receipt: Receipt }>(`/transfer-claims/${id}/confirm`, { amount, ...(note ? { note } : {}) });
/** reason required (400 VALIDATION_ERROR); parent is notified with it. */
export const rejectClaim = (id: string, reason: string) => http.post<TransferClaim>(`/transfer-claims/${id}/reject`, { reason });

export const CLAIM_REJECT_PRESETS = ["Chưa nhận được tiền", "Sai nội dung chuyển khoản", "Sai số tiền", "Chuyển nhầm tài khoản"];
export const FEES_ERR: Record<string, string> = {
  BANK_ACCOUNT_NOT_CONFIGURED: "Trường chưa mở thanh toán chuyển khoản, vui lòng đóng tại văn phòng",
  ALREADY_PAID: "Hóa đơn đã đóng đủ", ZERO_INVOICE: "Hóa đơn không có số tiền cần đóng", INVOICE_VOID: "Hóa đơn đã hủy",
  CLAIM_ALREADY_DECIDED: "Giao dịch này đã được xử lý", VALIDATION_ERROR: "Vui lòng nhập lý do",
};
export const feesErrorText = (e: unknown) => { const x = e as { errorCode?: string; code?: number; message?: string };
  return FEES_ERR[x?.errorCode ?? ""] ?? (x?.code === 403 ? "Bạn không có quyền với hóa đơn này" : x?.message ?? "Có lỗi xảy ra, vui lòng thử lại") };

// ── settings + feature detection ──
export type SchoolBank = { phone: string | null; bankTransfer: { enabled: boolean; sample: boolean } | null };
export const schoolBank = () => softGet<{ phone?: string; bankTransfer?: { enabled: boolean; sample: boolean } }>("/settings/school")
  .then(s => ({ phone: s?.phone ?? null, bankTransfer: s?.bankTransfer ?? null }) as SchoolBank);
export type FeeFeatures = { qr: boolean; claims: boolean; queue: boolean };
let feat: Promise<FeeFeatures> | null = null;
export function feeFeatures(): Promise<FeeFeatures> {
  feat ??= softGet<{ paths?: Record<string, unknown> }>(API_ORIGIN + "/api/docs-json").then(d => {
    const paths = Object.keys(d?.paths ?? {}); const has = (re: RegExp) => paths.some(p => re.test(p));
    return { qr: has(/\/invoices\/\{[^}]+\}\/qr$/), claims: has(/\/invoices\/\{[^}]+\}\/transfer-claims$/), queue: has(/\/transfer-claims$/) };
  });
  return feat;
}
