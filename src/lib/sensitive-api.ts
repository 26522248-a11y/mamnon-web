/**
 * B18 – Lịch sử thay đổi nhạy cảm (admin, read-only). Backend: GET /audit/sensitive, GET /audit/sensitive/export (CSV).
 * Phones arrive already masked ("0912 *** 456"); this client never sees full numbers.
 */
import { http } from "./api";

export type SensitiveType = "guardian_unlink" | "phone_change" | "photo_consent";
export type SensitiveItem = {
  id: string; createdAt: string; type: SensitiveType; typeLabel: string; action: string;
  target: { entity: string; id: string | null; label: string | null; childId: string | null; childName: string | null };
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; beforeText: string; afterText: string; reason: string | null;
  actor: { id: string | null; name: string | null; username: string | null; role: string | null; self: boolean }; ip: string | null;
};
export type SensitiveCounts = { all: number } & Record<SensitiveType, number>;
export type SensitiveQuery = { type?: SensitiveType | ""; from?: string; to?: string; q?: string; page?: number; limit?: number };

const qs = (q: SensitiveQuery) => new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => [k, String(v)])).toString();

export const listSensitive = (q: SensitiveQuery) =>
  http.get<{ total: number; page: number; limit: number; counts: SensitiveCounts; items: SensitiveItem[] }>(`/audit/sensitive?${qs(q)}`);

export const exportSensitiveCsv = (q: SensitiveQuery) => {
  const { page: _p, limit: _l, ...rest } = q; void _p; void _l;
  return http.download(`/audit/sensitive/export?${qs(rest)}`, `lich-su-thay-doi_${q.from || "all"}_${q.to || "all"}.csv`);
};

/** designer mockups8: unlink = rose, phone = sky, photo consent = peach */
export const TYPE_UI: Record<SensitiveType, { icon: string; chip: string; short: string; long: string; pill: string; border: string; row: string }> = {
  guardian_unlink: { icon: "🔗", chip: "Gỡ liên kết", short: "Gỡ", long: "Gỡ liên kết phụ huynh", pill: "bg-rose-100 text-rose-500", border: "border-rose-500", row: "bg-rose-100/40" },
  phone_change: { icon: "📞", chip: "SĐT", short: "SĐT", long: "Đổi SĐT", pill: "bg-sky-100 text-sky-500", border: "border-sky-500", row: "" },
  photo_consent: { icon: "📷", chip: "Đồng ý ảnh", short: "Ảnh", long: "Đồng ý ảnh", pill: "bg-peach-100 text-peach-500", border: "border-peach-500", row: "" },
};
export const TYPES: SensitiveType[] = ["guardian_unlink", "phone_change", "photo_consent"];

/** "113.161.5.21" → "113.x.x.21" (mockup); IPv6 → first block + last block. Full IP stays in the CSV export. */
export function maskIp(ip?: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, "").match(/^(\d+)\.\d+\.\d+\.(\d+)$/);
  if (v4) return `${v4[1]}.x.x.${v4[2]}`;
  const parts = ip.split(":").filter(Boolean);
  return parts.length > 2 ? `${parts[0]}:…:${parts[parts.length - 1]}` : ip;
}
