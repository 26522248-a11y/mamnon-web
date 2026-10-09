// Client API thật: NestJS /api/v1. Access token giữ trong bộ nhớ, refresh token nằm trong cookie httpOnly.
import { ApiError, Paged, Child, Attendance, AttStatus, User, ClassRoom } from "./types";
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001") + "/api/v1";
let token: string | null = null; let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  refreshing ??= fetch(BASE + "/auth/refresh", { method: "POST", credentials: "include" })
    .then(async r => { if (!r.ok) return false; const b = await r.json(); token = b.accessToken;
      // H5: the refresh response carries the user, so a new tab / reopened browser can rebuild the session from the cookie.
      if (b.user && typeof window !== "undefined") sessionStorage.setItem("me", JSON.stringify(b.user)); return true }).catch(() => false)
    .finally(() => { refreshing = null });
  return refreshing;
}
/** G10: không bao giờ hiện câu lỗi tiếng Anh/kỹ thuật cho người dùng. */
export const NET_ERR = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.";
export function viMsg(status: number, msg?: string | null): string {
  if (status === 0) return NET_ERR;
  if (status >= 500) return "Máy chủ đang bận hoặc gặp sự cố. Vui lòng thử lại sau ít phút.";
  if (msg && !/^[\x00-\x7F]*$/.test(msg)) return msg; // đã là tiếng Việt
  if (status === 403) return "Bạn không có quyền làm việc này.";
  if (status === 404) return "Không tìm thấy dữ liệu, có thể đã bị xoá.";
  if (status === 413) return "Tệp quá lớn, hãy chọn tệp nhỏ hơn.";
  if (status === 429) return "Thao tác quá nhanh, đợi một chút rồi thử lại.";
  return "Có lỗi xảy ra, vui lòng thử lại.";
}
const bodyMsg = (b: { message?: string | string[] } | null | undefined) => Array.isArray(b?.message) ? b.message.join("; ") : b?.message;
async function req<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!token && retry) await refresh();
  let r: Response; try { r = await fetch(BASE + path, { ...init, credentials: "include",
    headers: { ...(typeof FormData !== "undefined" && init.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(token ? { authorization: "Bearer " + token } : {}), ...init.headers } }) } catch { throw new ApiError(0, NET_ERR) }
  if (r.status === 401 && retry && await refresh()) return req<T>(path, init, false);
  if (r.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) { sessionStorage.removeItem("me"); location.href = "/login" }
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (r.status === 429 && body?.lockedUntil) throw new ApiError(429, `Tài khoản bị khóa đến ${new Date(body.lockedUntil).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })} do nhập sai mật khẩu nhiều lần`);
  if (r.status === 403 && body?.code === "PASSWORD_CHANGE_REQUIRED" && typeof window !== "undefined") {
    const me = sessionStorage.getItem("me"); if (me) sessionStorage.setItem("me", JSON.stringify({ ...JSON.parse(me), mustChangePassword: true }));
    if (!location.pathname.startsWith("/change-password")) location.href = "/change-password" }
  if (!r.ok) throw new ApiError(r.status, viMsg(r.status, bodyMsg(body)), body?.details, body?.code);
  return body as T;
}
const qs = (o: Record<string, unknown>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
export const api = {
  async login(username: string, password: string) {
    const r = await req<{ accessToken: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }, false);
    token = r.accessToken; sessionStorage.setItem("me", JSON.stringify(r.user)); return r.user; },
  me(): User | null { if (typeof window === "undefined") return null; const s = sessionStorage.getItem("me"); return s ? JSON.parse(s) : null },
  /** H5: user from this tab, or restored from the httpOnly refresh cookie (tab closed and reopened). null = really signed out. */
  async restore(): Promise<User | null> { const m = this.me(); if (m || typeof window === "undefined") return m; return (await refresh()) ? this.me() : null },
  async logout() { await req("/auth/logout", { method: "POST" }, false).catch(() => {}); token = null; sessionStorage.removeItem("me") },
  async changePassword(currentPassword: string, newPassword: string) {
    await req("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
    const me = this.me(); if (me) sessionStorage.setItem("me", JSON.stringify({ ...me, mustChangePassword: false })); },
  classes: () => req<ClassRoom[]>("/classes"),
  children: (q: { page?: number; limit?: number; classId?: string; search?: string }) =>
    req<Paged<Child>>("/children?" + qs({ page: q.page ?? 1, limit: q.limit ?? 10, classId: q.classId, search: q.search })),
  async getAttendance(classId: string, date: string): Promise<Attendance[]> {
    const r = await req<{ items: { childId: string; fullName: string; status: AttStatus | null; note: string | null }[] }>(`/classes/${classId}/attendance?date=${date}`);
    return r.items.map(i => ({ childId: i.childId, fullName: i.fullName, status: i.status ?? "unset", note: i.note ?? undefined })); },
  putAttendance: (classId: string, date: string, rows: Attendance[]) => req(`/classes/${classId}/attendance`, { method: "PUT",
    body: JSON.stringify({ date, items: rows.filter(r => r.status !== "unset").map(r => ({ childId: r.childId, status: r.status, note: r.note ?? null })) }) }),
};
export const http = {
  get: <T,>(p: string) => req<T>(p),
  post: <T,>(p: string, body?: unknown) => req<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T,>(p: string, body?: unknown) => req<T>(p, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T,>(p: string, body?: unknown) => req<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T,>(p: string, body?: unknown) => req<T>(p, { method: "DELETE", ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
  /** multipart/form-data: không đặt content-type để trình duyệt tự thêm boundary. */
  upload: <T,>(p: string, form: FormData) => req<T>(p, { method: "POST", body: form }),
  /** Upload multipart có tiến độ (XHR) – onProgress 0..100. */
  async uploadProgress<T>(p: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
    if (!token) await refresh();
    const send = () => new Promise<{ status: number; body: { message?: string | string[]; details?: never; code?: string } | null }>((ok, fail) => { const x = new XMLHttpRequest(); x.open("POST", BASE + p); x.withCredentials = true;
      if (token) x.setRequestHeader("authorization", "Bearer " + token);
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded * 100 / e.total)) };
      x.onload = () => { let b = null; try { b = JSON.parse(x.responseText) } catch { /* ignore */ } ok({ status: x.status, body: b }) }; x.onerror = () => fail(new ApiError(0, "Mất kết nối khi tải ảnh")); x.send(form) });
    let r = await send(); if (r.status === 401 && await refresh()) r = await send();
    if (r.status < 200 || r.status >= 300) throw new ApiError(r.status, r.status === 0 ? NET_ERR : viMsg(r.status, bodyMsg(r.body) ?? "Tải ảnh thất bại"), r.body?.details, r.body?.code);
    return r.body as T },
  /** Tải file cần token (vd. file mẫu .xlsx) rồi bấm tải xuống. */
  async download(url: string, fileName: string): Promise<void> {
    const u = await this.blobUrl(url); if (!u) throw new ApiError(0, "Không tải được file, vui lòng thử lại");
    saveUrl(u, fileName); setTimeout(() => URL.revokeObjectURL(u), 10000) },
  async blobUrl(url: string): Promise<string | null> {
    const full = url.startsWith("http") ? url : BASE.replace(/\/api\/v1$/, "") + (url.startsWith("/api") || url.startsWith("/uploads") ? "" : "/api/v1") + url;
    if (!token) await refresh();
    const r = await fetch(full, { credentials: "include", headers: token ? { authorization: "Bearer " + token } : {} });
    return r.ok ? URL.createObjectURL(await r.blob()) : null; },
};
/** GET không chuyển hướng về /login khi lỗi: trả null nếu không thành công (dùng cho trang công khai, tính năng tùy chọn). */
export async function softGet<T>(path: string): Promise<T | null> {
  try { const r = await fetch(path.startsWith("http") || path.startsWith("/api/") ? path : BASE + path, { credentials: "include", headers: token ? { authorization: "Bearer " + token } : {} });
    return r.ok ? (await r.json()) as T : null } catch { return null } }
export const API_ORIGIN = BASE.replace(/\/api\/v1$/, "");
function saveUrl(u: string, fileName: string) { const a = document.createElement("a"); a.href = u; a.download = fileName; document.body.appendChild(a); a.click(); a.remove() }
/** Lưu file từ chuỗi base64 (vd. resultFile của import) xuống máy. */
export function saveBase64(base64: string, fileName: string, mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  const bin = atob(base64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const u = URL.createObjectURL(new Blob([bytes], { type: mime })); saveUrl(u, fileName); setTimeout(() => URL.revokeObjectURL(u), 10000) }
/** School day (Asia/Ho_Chi_Minh), not the device timezone: P13 — a browser in UTC asked for yesterday until 07:00 VN. */
export const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

/** Landing page per role (H4 '/' and after login). */
export const roleHome = (m: { role: string; mustChangePassword?: boolean } | null) =>
  !m ? "/login" : m.mustChangePassword ? "/change-password" : m.role === "teacher" ? "/home" : m.role === "parent" ? "/today" : "/dashboard";
