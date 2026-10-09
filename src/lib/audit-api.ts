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
  ["pickup.identity_view", "Xem CCCD đầy đủ"],
];
export async function auditActions(): Promise<[string, string][]> { return KNOWN_ACTIONS }
export const actionLabel = (a: string) => KNOWN_ACTIONS.find(k => k[0] === a)?.[1] ?? a;

// ── display: Vietnamese field labels + values (fields seen in audit_events before/after/data, 09/10) ──
export const FIELD_LABEL: Record<string, string> = {
  phone1: "Số liên hệ 1", phone2: "Số liên hệ 2", phone: "Số điện thoại", fullName: "Họ tên", name: "Họ tên", childName: "Tên bé", relation: "Quan hệ",
  canPickup: "Được đón bé", isParentAccount: "Tài khoản phụ huynh", idNumber: "CCCD", photo: "Ảnh", status: "Trạng thái", parentStatus: "Phụ huynh xác nhận",
  schoolStatus: "Nhà trường duyệt", dates: "Ngày", date: "Ngày", note: "Ghi chú", photoConsent: "Đồng ý đăng ảnh", reason: "Lý do", kind: "Loại",
  field: "Dữ liệu xem", purpose: "Mục đích", username: "Tên đăng nhập", account: "Tài khoản", removed: "Đã gỡ", pickedUpByName: "Người đón", pickedUpAt: "Giờ đón",
  expiresAt: "Hết hạn lúc", decision: "Quyết định", step: "Bước",
};
const VALUE_TEXT: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", expired: "Hết hạn", active: "Đang hiệu lực", cancelled: "Đã hủy", confirmed: "Đã xác nhận",
  approve: "Đồng ý", reject: "Từ chối", set: "Có ảnh", id_number: "Số CCCD", handover: "Giao bé", guardian: "Phụ huynh", authorized_picker: "Người đón hộ", pickup_request: "Người ngoài danh sách",
  parent: "Phụ huynh", school: "Nhà trường",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Hide technical keys: ids / *Id / anything whose value is a UUID. */
export const hiddenField = (k: string, ...vals: unknown[]) => k === "id" || /Id$|Ids$/.test(k) || vals.some(v => typeof v === "string" && UUID.test(v));
export const fieldLabel = (k: string) => FIELD_LABEL[k] ?? k;
export function fieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (Array.isArray(v)) return v.map(fieldValue).join(", ") || "—";
  if (typeof v === "object") { const o = v as Record<string, unknown>;
    const main = o.name ?? o.fullName ?? o.username; if (main) return String(main) + (o.username && o.username !== main ? ` (${o.username})` : "");
    return Object.entries(o).filter(([k, x]) => !hiddenField(k, x)).map(([k, x]) => `${fieldLabel(k)}: ${fieldValue(x)}`).join("; ") || "—" }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDate(s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fmtDateTime(s);
  return VALUE_TEXT[s] ?? s;
}
