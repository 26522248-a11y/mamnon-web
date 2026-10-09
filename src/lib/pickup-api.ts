/**
 * Pickup-safety (đợt 1) API layer. Shapes follow /workspace/mamnon-backend/src/pickup/* and attendance.controller.ts
 * (uncommitted backend source, NOT yet deployed on :3001). Anything not confirmed in source is marked TODO(pickup-api).
 */
import { API_ORIGIN, http, softGet } from "@/lib/api"; import { ApiError } from "@/lib/types";

export type Step = "pending" | "approved" | "rejected";
export type ReqStatus = "pending" | "approved" | "rejected" | "expired";
export type Blocker = "EXPIRED" | "REJECTED" | "PARENT_PENDING" | "SCHOOL_PENDING" | "YOU_APPROVED" | string;

export type Delegate = {
  id: string; childId: string; childName?: string; fullName: string; relation: string | null; phone1: string; phone2: string | null;
  idNumberMasked: string | null; photoUrl: string | null; status: Step; onList?: boolean;
  decidedByName?: string | null; decidedAt?: string | null; decisionNote?: string | null; createdByName?: string | null; createdAt: string; updatedAt?: string;
};
export type PickupPeople = {
  childId: string;
  guardians: { id: string; fullName: string; relation: string; phone: string | null; idNumberMasked: string | null; canPickup: boolean; isParentAccount: boolean; isMe?: boolean; onList: boolean }[];
  authorizedPickers: Delegate[];
};
export type CallAttempt = { id: string; phone: string; guardianId: string | null; outcome: CallOutcome; note: string | null; calledBy: string; calledByName: string | null; at: string };
export type CallOutcome = "no_answer" | "busy" | "wrong_number" | "confirmed" | "rejected" | "other";
export type CallPhone = { order: number; guardianId: string | null; name: string | null; relation: string | null; phone: string; tel: string; source?: "contact" | "guardian" };
export type Escalation = { afterMinutes: number; dueAt: string; due: boolean; promptCall: boolean; phones: CallPhone[]; nextPhone: CallPhone | null; callAttempts: CallAttempt[] };
export type MultiWarning = { code: "SAME_PICKER_MULTIPLE_CHILDREN"; message: string; children: { childId: string; childName: string; relation: string | null }[] };
export type StepInfo = { status: Step; decidedBy: string | null; decidedByName: string | null; decidedAt: string | null; note: string | null };
export type PickupRequest = {
  id: string; attendanceId: string; childId: string; childName?: string; classId: string;
  /** backend adding (not deployed yet); render only when present */ className?: string | null;
  /** backend adding to parent feed: when the 15-min call escalation starts. Fallback: escalation.dueAt, then createdAt + ESCALATE_MIN. */ dueAt?: string | null;
  pickerName: string; pickerPhone: string; pickerIdNumberMasked: string | null; relation: string | null; note: string;
  photoUrl: string | null; status: ReqStatus; expiresAt: string | null; requestedBy: string | null; createdAt: string;
  parent: StepInfo & { channel: "app" | "push" | "on_behalf" | string | null };
  school: StepInfo & { role: "admin" | "duty" | null };
  blockers: Blocker[]; readyForHandover: boolean; decidedOnBehalf?: boolean; decisionNote?: string | null;
  /** parent views only */ needsMyAction?: boolean;
  /** staff views only */ escalation?: Escalation; warnings?: MultiWarning[];
};
export type PickupOptions = {
  attendanceId: string; date: string; status: string | null;
  child: { id: string; fullName: string; className: string | null; photoUrl: string | null };
  pickedUp: { pickedUpByName: string; relation: string | null; pickedUpAt: string; pickerKind?: string } | null;
  guardians: { kind: "guardian"; id: string; fullName: string; relation: string; phone: string | null; idNumberMasked: string | null; hasAccount: boolean; canPickup: boolean; canHandOver: boolean; blockers: string[] }[];
  authorizedPickers: (Delegate & { kind: "authorized_picker"; canHandOver: boolean; blockers: string[] })[];
  requests: (PickupRequest & { kind: "pickup_request"; canHandOver: boolean })[];
};
export type IdentityKind = "guardian" | "authorized_picker" | "pickup_request";
export type Identity = { kind: IdentityKind; id: string; fullName: string; relation: string | null; idNumber: string | null; photoUrl: string | null; phones: string[]; audited: boolean };
export type Duty = { id: string; date: string; userId: string; userName: string; userRole: string; assignedBy: string | null; note: string | null; createdAt: string };
export type MyDuty = { today: string; onDutyToday: boolean; canApproveToday: boolean; upcoming: Duty[] };

export const ESCALATE_MIN = 15; // backend PICKUP_ESCALATE_MINUTES default; used only when the server sends no dueAt
/** Server dueAt first (feed: r.dueAt, staff: r.escalation.dueAt); createdAt + 15' only for older backends without the field. */
export const requestDueAt = (r: Pick<PickupRequest, "dueAt" | "escalation" | "createdAt">) =>
  r.dueAt ?? r.escalation?.dueAt ?? new Date(new Date(r.createdAt).getTime() + ESCALATE_MIN * 60_000).toISOString();

// ── delegates (người đón hộ) ──
export const pickupPeople = (childId: string) => http.get<PickupPeople>(`/children/${childId}/pickup-people`);
/** multipart: fullName, relation, idNumber (12 số), phone1, phone2?, photo (JPG/PNG, bắt buộc). 409 DUPLICATE_PICKER. */
export const addDelegate = (childId: string, f: FormData) => http.upload<Delegate>(`/children/${childId}/authorized-pickers`, f);
export const removeDelegate = (id: string) => http.del(`/authorized-pickers/${id}`);
export const listDelegates = (q: { status?: Step; childId?: string } = {}) =>
  http.get<Delegate[]>(`/authorized-pickers?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`);
export const approveDelegate = (id: string, note?: string) => http.post<Delegate>(`/authorized-pickers/${id}/approve`, note ? { note } : {});
/** reject: note bắt buộc (400 NOTE_REQUIRED) */
export const rejectDelegate = (id: string, note: string) => http.post<Delegate>(`/authorized-pickers/${id}/reject`, { note });

// ── requests (người ngoài danh sách, 2 bước) ──
export const parentFeed = (childId?: string) =>
  http.get<{ date: string; pendingCount: number; items: PickupRequest[] }>(`/pickup-requests/feed${childId ? "?childId=" + childId : ""}`);
export const listRequests = (q: { status?: ReqStatus; childId?: string; date?: string } = {}) =>
  http.get<PickupRequest[]>(`/pickup-requests?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`);
export const getRequest = (id: string) => http.get<PickupRequest>(`/pickup-requests/${id}`);
/** Parent → parent step; admin / today's duty → school step (reject needs note). Teacher not on duty → 403 NOT_ON_DUTY. */
export const confirmRequest = (id: string, note?: string) => http.post<PickupRequest>(`/pickup-requests/${id}/confirm`, note ? { note } : {});
export const rejectRequest = (id: string, note?: string) => http.post<PickupRequest>(`/pickup-requests/${id}/reject`, note ? { note } : {});
/** Admin records the parent's answer obtained by phone (note mandatory). */
export const parentOnBehalf = (id: string, decision: "approve" | "reject", note: string) =>
  http.post<PickupRequest>(`/pickup-requests/${id}/parent-decision`, { decision, note });
export const logCall = (id: string, b: { phone: string; outcome: CallOutcome; guardianId?: string; note?: string }) =>
  http.post<PickupRequest>(`/pickup-requests/${id}/call-attempts`, b);
/** multipart or JSON: pickerName, pickerPhone, relation?, note (bắt buộc), pickerIdNumber? (12 số), photo? */
export const createRequest = (attendanceId: string, f: FormData) => http.upload<PickupRequest>(`/attendance/${attendanceId}/pickup-requests`, f);

// ── handover ──
export const pickupOptions = (attendanceId: string) => http.get<PickupOptions>(`/attendance/${attendanceId}/pickup-options`);
/** Full CCCD; every call is audit-logged by the backend, so call it only when the handover screen opens a person. */
export const pickupIdentity = (attendanceId: string, kind: IdentityKind, id: string) =>
  http.get<Identity>(`/attendance/${attendanceId}/pickup-identity?kind=${kind}&id=${id}`);
/** U10/U5: optional hand-over photo → multipart; parents get "🚸 Bé X đã được đón" with it. */
export const handOver = (attendanceId: string, b: { guardianId?: string; authorizedPickerId?: string; pickupRequestId?: string; note?: string }, photo?: File | null) => {
  type R = { pickedUpByName: string; pickedUpAt: string; warnings: MultiWarning[]; photoUrl?: string | null; handedOverByName?: string };
  if (!photo) return http.post<R>(`/attendance/${attendanceId}/pickup`, b);
  const f = new FormData(); Object.entries(b).forEach(([k, v]) => { if (v) f.append(k, v) }); f.append("photo", photo);
  return http.upload<R>(`/attendance/${attendanceId}/pickup`, f) };

// ── parent's own contact phones (① / ② the teacher calls after 15 minutes) ──
/** Backend ContactPhonesController (pickup/authorized-pickers.controller.ts). phone1/2 null = never set → callOrder falls back to guardian phones. */
export type ContactPhones = { childId: string; phone1: string | null; phone2: string | null; updatedBy: string | null; updatedByName: string | null; updatedAt: string | null; callOrder: CallPhone[] };
export const getContactPhones = (childId: string) => http.get<ContactPhones>(`/children/${childId}/contact-phones`);
/** admin | parent of the child. phone2 "" clears it; 400 when phone2 = phone1. Parent edits notify admins (type contact_change); history kept. */
export const updateContactPhones = (childId: string, b: { phone1: string; phone2: string }) => http.patch<ContactPhones>(`/children/${childId}/contact-phones`, b);

// ── duty (trực đón) ──
export const myDuty = () => softGet<MyDuty>("/pickup-duties/me");
export const listDuties = (from: string, to: string) => http.get<Duty[]>(`/pickup-duties?from=${from}&to=${to}`);
export const assignDuty = (userId: string, dates: string[], note?: string) => http.post<Duty[]>("/pickup-duties", { userId, dates, note });
export const removeDuty = (id: string) => http.del(`/pickup-duties/${id}`);

// ── helpers ──
/** "079123456789" → "0791 •••• 6789" (handover screen: first 4 + last 4). */
export const idFirstLast = (v?: string | null) => (v && v.length >= 8 ? `${v.slice(0, 4)} •••• ${v.slice(-4)}` : v || "chưa có");
/** "********6789" → "•••• 6789" (lists: last 4 only). */
export const idLast4 = (masked?: string | null) => (masked ? `•••• ${masked.slice(-4)}` : "chưa có");
export const maskPhone = (p?: string | null) => (p && p.length > 6 ? `${p.slice(0, 4)} xxx ${p.slice(-3)}` : p ?? "");
export const BLOCKER_TEXT: Record<string, string> = {
  EXPIRED: "Yêu cầu đã hết hạn", REJECTED: "Đã bị từ chối, KHÔNG giao bé", PARENT_PENDING: "Chờ phụ huynh xác nhận", SCHOOL_PENDING: "Chờ nhà trường duyệt",
  YOU_APPROVED: "Bạn đã duyệt yêu cầu này nên không được tự giao bé, nhờ người khác giao", NOT_APPROVED_YET: "Chưa được nhà trường duyệt", NOT_ALLOWED: "Không được đón bé",
};
export const OUTCOME_TEXT: Record<CallOutcome, string> = {
  no_answer: "Không nghe máy", busy: "Máy bận", wrong_number: "Sai số", confirmed: "PH đồng ý qua ĐT", rejected: "PH không đồng ý", other: "Khác",
};
export const REJECT_PRESETS = ["Không khớp giấy tờ", "Ảnh không khớp người đến đón", "PH không đồng ý", "Không liên lạc được phụ huynh", "Khác"];
export const DELEGATE_REJECT_PRESETS = ["Ảnh mờ, không rõ mặt", "Thiếu hoặc sai số giấy tờ", "Phụ huynh không xác nhận", "Khác"];

// ── web push ──
function b64ToU8(b64: string) { const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(s); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
export type PushState = "unsupported" | "disabled" | "denied" | "default" | "subscribed";
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
/** sw.js URL carries the API origin so notification actions can POST /push/actions without a session (public, token-signed). */
export const SW_URL = `/sw.js?api=${encodeURIComponent(API_ORIGIN)}`;
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const k = await softGet<{ publicKey: string | null; enabled: boolean }>("/push/vapid-public-key");
  if (!k?.enabled || !k.publicKey) return "disabled";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ? "subscribed" : "default";
}
/** Must be called from a user gesture (iOS: only inside the installed PWA). */
export async function subscribePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const k = await http.get<{ publicKey: string | null; enabled: boolean }>("/push/vapid-public-key");
  if (!k.enabled || !k.publicKey) return "disabled";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register(SW_URL, { scope: "/" }));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.publicKey) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await http.post("/push/subscriptions", { endpoint: j.endpoint, keys: j.keys });
  return "subscribed";
}
export async function unsubscribePush() {
  const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
  if (!sub) return;
  await http.del("/push/subscriptions", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** Backend imageUploadOptions: 3 MB max, JPG/PNG (magic bytes). Phone cameras often exceed it → downscale to ≤1280px JPEG. */
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
/** File inputs: JPG/PNG plus iPhone HEIC/HEIF (extensions too, since some browsers report an empty MIME type for .heic). */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif";
export const isHeic = (f: File) => /^image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
export const isAllowedPhoto = (f: File) => /^image\/(jpeg|png)$/.test(f.type) || isHeic(f);
/** Downscale to JPEG when the browser can decode it; otherwise (HEIC on Chrome/Firefox) return the file untouched → uploaded as-is. */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.85): Promise<File> {
  if (file.size <= PHOTO_MAX_BYTES && /^image\/(jpeg|png)$/.test(file.type)) return file;
  const bmp = typeof createImageBitmap === "function" ? await createImageBitmap(file).catch(() => null) : null;
  if (!bmp) return file; // can't decode (typically HEIC) → upload as-is; backend decides
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, "image/jpeg", quality));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

// ── error messages (docs/pickup-safety.md §3–4) ──
const STEP_TEXT: Record<string, string> = { PARENT_PENDING: "Chờ phụ huynh xác nhận", SCHOOL_PENDING: "Chờ nhà trường duyệt" };
const CODE_TEXT: Record<string, string> = {
  ALREADY_PICKED_UP: "Bé đã được đón rồi, không cần tạo yêu cầu hay giao bé nữa. Tải lại trang để xem ai đã đón.",
  PICKUP_NOT_ALLOWED: "Người này không được phép đón bé.", PICKER_NOT_APPROVED: "Người đón hộ chưa được nhà trường duyệt",
  PICKUP_REQUEST_REJECTED: "Yêu cầu đón đã bị từ chối, KHÔNG giao bé.", PICKUP_REQUEST_EXPIRED: "Yêu cầu đón đã hết hạn, cần tạo yêu cầu mới.",
  APPROVER_CANNOT_HAND_OVER: "Bạn đã duyệt yêu cầu này nên không được tự giao bé, nhờ người khác giao.",
  NOT_ON_DUTY: "Chỉ Ban giám hiệu hoặc người trực đón hôm nay được duyệt.", ALREADY_DECIDED: "Yêu cầu này đã được xử lý.", REQUEST_EXPIRED: "Yêu cầu đã hết hạn.",
};
/** Map backend pickup error codes to Vietnamese; 403 PICKUP_REQUEST_PENDING lists the missing steps from `details`. */
export function pickupErrorText(e: unknown): string {
  const x = e as ApiError;
  if (x?.errorCode === "PICKUP_REQUEST_PENDING") {
    const steps = (Array.isArray(x.details) ? x.details : []).map(s => STEP_TEXT[String(s)]).filter(Boolean);
    return `Chưa giao được bé: ${steps.length ? steps.join(", ") : "chưa đủ 2 bước xác nhận"}.`;
  }
  if (x?.code === 409 && (x.errorCode === "ALREADY_PICKED_UP" || !x.errorCode)) return CODE_TEXT.ALREADY_PICKED_UP;
  return (x?.errorCode && CODE_TEXT[x.errorCode]) || x?.message || "Có lỗi xảy ra, vui lòng thử lại";
}
export const PHONE_SOURCE_TEXT: Record<string, string> = { contact: "Số liên hệ phụ huynh đặt", guardian: "Số trong hồ sơ phụ huynh" };
