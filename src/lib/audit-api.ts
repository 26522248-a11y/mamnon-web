/**
 * Admin audit log — aligned to /workspace/mamnon-backend/src/audit/audit.controller.ts (GET /audit-events, admin only).
 *   ?childId&action (comma list, "prefix.*" wildcard)&actorId|actor(username)&entityType&entityId&from&to (VN dates, inclusive)&page&limit(≤200)
 *   → {total, page, limit, items: AuditEventRaw[]} newest first. No /actions endpoint: action list is static (from backend recordAudit calls).
 */
import { http } from "@/lib/api"; import { fmtDate, fmtDateTime } from "@/lib/date";
type AuditEventRaw = { id: string; createdAt: string; action: string; entityType: string | null; entityId: string | null; childId: string | null; childName: string | null;
  actorId: string | null; actorUsername: string | null; actorName: string | null; actorRole: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; ip: string | null; data: Record<string, unknown> | null; source: string | null };
export type AuditEvent = AuditEventRaw & { at: string };
export type AuditQuery = { childId?: string; action?: string; actorId?: string; actor?: string; entityType?: string; entityId?: string; from?: string; to?: string; page?: number; limit?: number };
export async function listAudit(q: AuditQuery) {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
  const r = await http.get<{ total: number; page: number; limit: number; items: AuditEventRaw[] }>(`/audit-events?${qs}`);
  return { total: r.total, items: r.items.map(e => ({ ...e, at: e.createdAt, actorName: e.actorName ?? e.actorUsername })) };
}
/** Actions the backend actually records (grep recordAudit, 09/10) + round2 §9. Wildcard entries filter by prefix. */
export const KNOWN_ACTIONS: [string, string][] = [
  ["guardian.remove", "Gỡ liên kết phụ huynh"], ["child.contact_phones", "Đổi SĐT liên hệ đón"], ["child.photo_consent", "Đổi đồng ý đăng ảnh"],
  ["authorized_picker.*", "Người đón hộ (mọi thao tác)"], ["authorized_picker.approve", "Duyệt người đón hộ"], ["authorized_picker.reject", "Từ chối người đón hộ"],
  ["authorized_picker.delete", "Xoá người đón hộ"], ["pickup_request.parent_on_behalf", "Ghi ý kiến phụ huynh qua điện thoại"],
  ["pickup_duty.*", "Lịch trực đón (mọi thao tác)"], ["pickup_duty.assign", "Phân công trực đón"], ["pickup_duty.remove", "Bỏ phân công trực đón"],
  ["pickup.identity_view", "Xem số giấy tờ đầy đủ"], ["child.reenroll", "Cho bé đi học lại"], ["user.phone", "Đổi SĐT tài khoản"],
  ["finance.*", "Thu chi (mọi thao tác)"], ["finance.income.create", "Ghi khoản thu"], ["finance.expense.create", "Ghi khoản chi"],
  ["finance.entry.approve", "Duyệt khoản chi"], ["finance.entry.reject", "Từ chối khoản chi"], ["finance.entry.void", "Huỷ khoản thu chi"],
  ["finance.receipt.attach", "Đính kèm hoá đơn"], ["finance_category.create", "Thêm danh mục thu chi"], ["finance_category.update", "Sửa danh mục thu chi"],
  ["transfer_claim.*", "Báo chuyển khoản (mọi thao tác)"], ["transfer_claim.create", "Phụ huynh báo đã chuyển khoản"], ["transfer_claim.confirm", "Xác nhận đã nhận tiền"], ["transfer_claim.reject", "Từ chối báo chuyển khoản"],
  ["staff_leave.*", "Nghỉ phép (mọi thao tác)"], ["staff_leave.request", "Xin nghỉ"], ["staff_leave.create_approved", "Ghi nghỉ (đã duyệt sẵn)"], ["staff_leave.approve", "Duyệt đơn nghỉ"],
  ["staff_leave.reject", "Từ chối đơn nghỉ"], ["staff_leave.cancel", "Huỷ đơn nghỉ"], ["staff_attendance.correct", "Sửa giờ chấm công"],
  ["substitution.assign", "Phân cô trông thay"], ["substitution.remove", "Bỏ phân trông thay"], ["holiday.emergency", "Báo trường nghỉ đột xuất"],
  ["photo_post.create", "Đăng ảnh lớp"], ["photo_post.delete", "Xoá bài ảnh lớp"], ["photo.tags", "Sửa tên bé trong ảnh"], ["photo.unhide", "Bỏ ẩn ảnh"], ["photo.delete", "Xoá ảnh"],
];
export async function auditActions(): Promise<[string, string][]> { return KNOWN_ACTIONS }
const ENTITY_LABEL: Record<string, string> = { finance: "Thu chi", transfer_claim: "Chuyển khoản", staff_leave: "Nghỉ phép", staff_attendance: "Chấm công", substitution: "Trông thay",
  authorized_picker: "Người đón hộ", pickup_duty: "Trực đón", pickup: "Đón bé", child: "Hồ sơ bé", guardian: "Phụ huynh", user: "Tài khoản", holiday: "Ngày nghỉ", photo: "Ảnh lớp", photo_post: "Ảnh lớp" };
const VERB_LABEL: Record<string, string> = { create: "Tạo", update: "Sửa", delete: "Xoá", remove: "Gỡ", approve: "Duyệt", reject: "Từ chối", cancel: "Huỷ", void: "Huỷ", confirm: "Xác nhận", assign: "Phân công", request: "Yêu cầu" };
/** H2: always Vietnamese – known list first, else "<nhóm> · <việc>" (never the raw technical code). */
export const actionLabel = (a: string) => { const k = KNOWN_ACTIONS.find(x => x[0] === a)?.[1]; if (k) return k;
  const parts = a.split("."); const ent = ENTITY_LABEL[parts[0]] ?? "Thao tác"; const verb = VERB_LABEL[parts[parts.length - 1]];
  return verb ? `${ent} · ${verb}` : ent };

// ── display: Vietnamese field labels + values (fields seen in audit_events before/after/data, 09/10) ──
export const FIELD_LABEL: Record<string, string> = {
  phone1: "Số liên hệ 1", phone2: "Số liên hệ 2", phone: "Số điện thoại", fullName: "Họ tên", name: "Họ tên", childName: "Tên bé", relation: "Quan hệ",
  canPickup: "Được đón bé", isParentAccount: "Tài khoản phụ huynh", idNumber: "Số giấy tờ", photo: "Ảnh", status: "Trạng thái", parentStatus: "Phụ huynh xác nhận",
  schoolStatus: "Nhà trường duyệt", dates: "Ngày", date: "Ngày", note: "Ghi chú", photoConsent: "Đồng ý đăng ảnh", reason: "Lý do", kind: "Loại",
  field: "Dữ liệu xem", purpose: "Mục đích", username: "Tên đăng nhập", account: "Tài khoản", removed: "Đã gỡ", pickedUpByName: "Người đón", pickedUpAt: "Giờ đón",
  expiresAt: "Hết hạn lúc", decision: "Quyết định", step: "Bước",
  amount: "Số tiền", claimedAmount: "Số tiền báo chuyển", receivedAmount: "Số tiền nhận", amountDue: "Số tiền phải thu", creditAdded: "Cộng vào số dư",
  category: "Danh mục", title: "Nội dung", receipt: "Hoá đơn", receiptNo: "Số hoá đơn", invoiceNo: "Số phiếu thu", transferredAt: "Chuyển lúc", claimedAt: "Báo lúc",
  decidedAt: "Duyệt lúc", rejectReason: "Lý do từ chối", type: "Loại", session: "Buổi", days: "Số ngày công", fromDate: "Từ ngày", toDate: "Đến ngày", shiftName: "Ca",
  className: "Lớp", checkInAt: "Giờ vào ca", checkOutAt: "Giờ ra ca", consent: "Đồng ý đăng hình", enrolledAt: "Ngày nhập học", leaveDate: "Ngày nghỉ học",
  withdrawalReason: "Lý do nghỉ học", startDate: "Ngày bắt đầu", added: "Thêm", auto: "Tự động", onBehalf: "Thay phụ huynh", requested: "Yêu cầu", roster: "Danh sách",
  beforeSource: "Nguồn trước", storedBefore: "Đã lưu trước", alreadyAssigned: "Đã phân trước",
};
/** H2: money fields → 12.000.000đ */
const MONEY = new Set(["amount", "claimedAmount", "receivedAmount", "amountDue", "creditAdded"]);
const KEY_VALUE: Record<string, Record<string, string>> = {
  kind: { in: "Thu", out: "Chi" }, type: { sick: "Ốm", annual: "Phép năm", personal: "Việc riêng" }, session: { full: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" },
};
const VALUE_TEXT: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", expired: "Hết hạn", active: "Đang hiệu lực", cancelled: "Đã hủy", confirmed: "Đã xác nhận",
  approve: "Đồng ý", reject: "Từ chối", set: "Có ảnh", id_number: "Số căn cước", handover: "Giao bé", guardian: "Phụ huynh", authorized_picker: "Người đón hộ", pickup_request: "Người ngoài danh sách",
  parent: "Phụ huynh", school: "Nhà trường", void: "Đã huỷ", requested: "Đã gửi", in: "Thu", out: "Chi",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Hide technical keys: ids / *Id / anything whose value is a UUID. */
export const hiddenField = (k: string, ...vals: unknown[]) => k === "id" || /Id$|Ids$/.test(k) || vals.some(v => typeof v === "string" && UUID.test(v));
export const fieldLabel = (k: string) => FIELD_LABEL[k] ?? k;
export function fieldValue(v: unknown, key?: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key && MONEY.has(key) && (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)))) return Math.round(Number(v)).toLocaleString("vi-VN") + "đ";
  if (key && typeof v === "string" && KEY_VALUE[key]?.[v]) return KEY_VALUE[key][v];
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (Array.isArray(v)) return v.map(x => fieldValue(x, key)).join(", ") || "—";
  if (typeof v === "object") { const o = v as Record<string, unknown>;
    const main = o.name ?? o.fullName ?? o.username; if (main) return String(main) + (o.username && o.username !== main ? ` (${o.username})` : "");
    return Object.entries(o).filter(([k, x]) => !hiddenField(k, x)).map(([k, x]) => `${fieldLabel(k)}: ${fieldValue(x, k)}`).join("; ") || "—" }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDate(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fmtDateTime(s);
  return VALUE_TEXT[s] ?? s;
}
