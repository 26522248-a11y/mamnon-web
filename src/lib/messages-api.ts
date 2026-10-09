/**
 * Wave 2 (đợt 2): parent messages — absence, medicine, late pickup — plus teacher side, notes, dashboard, photo consent.
 * Contract: /workspace/mamnon-backend/docs/round2-api.md (09/10). Pages import only from here. msgFeatures() still gates each
 * part via Swagger so 2a/2b can ship separately.
 */
import { API_ORIGIN, http, softGet } from "@/lib/api";
/** Backend list endpoints return {items: T[]} (69180e6); accept a bare array too. */
const unwrap = <T,>(r: T[] | { items?: T[] } | null | undefined): T[] => Array.isArray(r) ? r : r?.items ?? [];
const list = <T,>(p: string) => http.get<T[] | { items: T[] }>(p).then(r => unwrap<T>(r));

// ── config (§0): GET /settings/school (public); GET /absences/config {cutoff, latestPickup} as fallback ──
export type MsgConfig = { absenceCutoff: string; latestPickup: string; schoolOpenTime: string; medicineLateMinutes: number; source: "api" | "default" };
const DEFAULTS = { absenceCutoff: "08:00", latestPickup: "18:00", schoolOpenTime: "06:30", medicineLateMinutes: 30 };
type SchoolSettings = { absenceCutoff?: string; latestPickupTime?: string; latestPickup?: string; schoolOpenTime?: string; medicineLateMinutes?: number };
let cfg: Promise<MsgConfig> | null = null;
export function getMsgConfig(): Promise<MsgConfig> {
  cfg ??= (async () => {
    const s = await softGet<SchoolSettings>("/settings/school");
    const c = s?.absenceCutoff ? null : await softGet<{ cutoff?: string; latestPickup?: string }>("/absences/config");
    const hm = (...v: (string | undefined)[]) => v.find(x => typeof x === "string" && /^\d{1,2}:\d{2}/.test(x))?.slice(0, 5);
    const cut = hm(s?.absenceCutoff, c?.cutoff);
    return { absenceCutoff: cut ?? DEFAULTS.absenceCutoff, latestPickup: hm(s?.latestPickupTime, s?.latestPickup, c?.latestPickup) ?? DEFAULTS.latestPickup,
      schoolOpenTime: hm(s?.schoolOpenTime) ?? DEFAULTS.schoolOpenTime,
      medicineLateMinutes: typeof s?.medicineLateMinutes === "number" ? s.medicineLateMinutes : DEFAULTS.medicineLateMinutes, source: cut ? "api" : "default" };
  })();
  return cfg;
}
/** VN wall-clock "HH:MM" now. */
export const vnNowHHMM = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
export const vnToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
export const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) };
const isWeekend = (d: string) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay());
/** Client PREVIEW only (server decides): refund iff reported strictly before cutoff on that day (future days always), never weekends. */
export function refundPreview(date: string, cutoff: string, now = vnNowHHMM(), today = vnToday()) {
  if (isWeekend(date)) return false;
  return date > today || (date === today && now < cutoff);
}

// ── absences (§1) ──
export type AbsenceReason = "sick" | "family" | "other";
export const ABSENCE_REASONS: [AbsenceReason, string][] = [["sick", "🤒 Ốm"], ["family", "✈️ Việc gia đình"], ["other", "Khác"]];
export type AbsenceDay = { date: string; refundEligible: boolean; overridden: boolean /* GV điểm "Có mặt" → không hoàn tiền */; cancelled: boolean; cancelledAt: string | null; reportedAt?: string };
export type AbsenceHistory = { action: "created" | "cancelled" | "overridden"; dates: string[]; by: string | null; byName: string | null; byRole: string | null; at: string };
export type Absence = { id: string; childId: string; childName: string; classId: string; className: string | null; from: string; to: string; reason: AbsenceReason; note: string | null;
  days: AbsenceDay[]; skippedDates: { date: string; reason: "WEEKEND" | "HOLIDAY" | "ALREADY_PRESENT" }[];
  status: "active" | "partly_cancelled" | "cancelled"; cancellable: string[]; createdAt: string; createdBy: string | null; createdByName: string | null;
  cancelledAt: string | null; history: AbsenceHistory[] };
/** 400 DATE_IN_PAST / NO_SCHOOL_DAYS / CHILD_WITHDRAWN, 409 ABSENCE_OVERLAP (details = dates). `to` defaults to `from`. */
export const reportAbsence = (childId: string, b: { from: string; to?: string; reason: AbsenceReason; note?: string }) => http.post<Absence>(`/children/${childId}/absences`, b);
/** All reports overlapping [from,to] incl. cancelled, newest first (server default from = today − 30). */
export const listAbsences = (childId: string, from?: string, to?: string) =>
  list<Absence>(`/children/${childId}/absences?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v) as [string, string][])}`);
export const getAbsence = (id: string) => http.get<Absence>(`/absences/${id}`);
/** Cancels all cancellable days, or only `dates`. 409 CANCEL_AFTER_CUTOFF when nothing is cancellable. */
export const cancelAbsence = (id: string, dates?: string[]) => http.del<Absence>(`/absences/${id}`, dates?.length ? { dates } : undefined);
export const ABSENCE_ERR: Record<string, string> = { DATE_IN_PAST: "Không báo nghỉ cho ngày đã qua", NO_SCHOOL_DAYS: "Các ngày đã chọn đều là cuối tuần, ngày nghỉ hoặc bé đã có mặt",
  ABSENCE_OVERLAP: "Đã có báo nghỉ cho ngày này", CHILD_WITHDRAWN: "Bé đã nghỉ học", CANCEL_AFTER_CUTOFF: "Đã quá giờ hủy báo nghỉ của hôm nay. Nếu bé vẫn đi học, bố mẹ báo trực tiếp cô giáo nhé", SCHOOL_HOLIDAY: "Ngày này trường nghỉ" };

// ── holidays (§2 + 228bba9 addendum: status pending|confirmed; only confirmed ones have any effect) ──
export type Holiday = { id: string; date: string; name: string; kind: "national" | "school" | "emergency"; status: "pending" | "confirmed"; reason?: string | null;
  createdBy: string | null; createdByName: string | null; createdAt: string; confirmedBy?: { id: string; name: string | null } | null; confirmedByName?: string | null; confirmedAt?: string | null };
export const listHolidays = (q: { year?: number; from?: string; to?: string; status?: "pending" | "confirmed" }) =>
  list<Holiday>(`/holidays?${new URLSearchParams(Object.entries(q).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))}`);
/** Admin-created days are confirmed immediately. 409 HOLIDAY_EXISTS / HOLIDAY_HAS_ATTENDANCE (details.dates). → {items} */
export const createHoliday = (b: { date: string; to?: string; name: string; kind?: "national" | "school" }) => http.post<{ items: Holiday[] }>("/holidays", b);
export const updateHoliday = (id: string, b: { name?: string; kind?: "national" | "school" }) => http.patch<Holiday>(`/holidays/${id}`, b);
export const deleteHoliday = (id: string) => http.del(`/holidays/${id}`);
/** Admin: pending → confirmed (Tết / Giỗ Tổ lunar dates come in as pending). */
export const confirmHoliday = (id: string) => http.post<Holiday>(`/holidays/${id}/confirm`, {});
/** Admin: confirm every pending day of a year ("Xác nhận cả năm"). */
export const confirmHolidayYear = (year: number) => http.post<{ year: number; confirmed: Holiday[] }>("/holidays/confirm", { year });
/** Template items: solar holidays come as confirmed, lunar (Tết, Giỗ Tổ) as pending. */
export type HolidayTemplate = { year: number; items: { date: string; name: string; status: "pending" | "confirmed"; exists: boolean }[] };
export const holidayTemplatePreview = (year: number) => http.post<HolidayTemplate>("/holidays/template", { year, dryRun: true });
export const holidayTemplateApply = (year: number) => http.post<{ year: number; created: Holiday[]; skipped: { date: string; name: string }[] }>("/holidays/template", { year, dryRun: false });
/** 2b emergency closure (admin). dryRun → counts for the confirm dialog; nothing written. 400 NOT_SCHOOL_DAY / VALIDATION_ERROR, 409 HOLIDAY_EXISTS. */
export type EmergencyPreview = { dryRun: true; date: string; name: string; reason: string; parentsToNotify: number; childrenRefunded: number; childrenPresent: number; childrenTotal: number;
  /** 81c8a40 */ childrenWithoutParentCount?: number; /** kids with no linked parent account (call them) */ childrenWithoutParent?: { childId: string; name: string; className: string | null; phone1: string | null }[] };
export type EmergencyResult = { holiday: Holiday; parentsNotified: number; childrenRefunded: number; childrenPresent: number; absentRowsCreated: number };
export const emergencyPreview = (date: string, reason: string, name?: string) => http.post<EmergencyPreview>("/holidays/emergency", { date, reason, ...(name ? { name } : {}), dryRun: true });
export const emergencyClose = (date: string, reason: string, name?: string) => http.post<EmergencyResult>("/holidays/emergency", { date, reason, ...(name ? { name } : {}) });
export const EMERGENCY_REASONS = ["Bão", "Ngập", "Dịch bệnh", "Mất điện", "Khác"];
/** Today's confirmed holiday / closure from GET /settings/school (public, not cached: changes during the day). */
export type TodayClosure = { date: string; id: string; name: string; kind: "national" | "school" | "emergency"; reason: string | null };
export const getTodayClosure = () => softGet<{ todayClosure?: TodayClosure | null }>("/settings/school").then(s => s?.todayClosure ?? null);
export const isConfirmedHoliday = (h: Holiday) => h.status !== "pending";
export const HOLIDAY_ERR: Record<string, string> = { HOLIDAY_EXISTS: "Ngày này đã có trong lịch nghỉ", HOLIDAY_HAS_ATTENDANCE: "Ngày này đã có điểm danh, không thêm ngày nghỉ được", NOT_SCHOOL_DAY: "Ngày cuối tuần, trường vốn đã nghỉ",
  INVALID_RANGE: "Ngày kết thúc phải sau ngày bắt đầu", RANGE_TOO_LONG: "Tối đa 60 ngày mỗi lần", TEMPLATE_YEAR_UNSUPPORTED: "Chưa có mẫu ngày lễ cho năm này" };

/** Absence history (parent /messages): reports overlapping [from, to]; refundEligible is shown verbatim, never computed here. */
export const absenceHistory = (childId: string, from: string, to: string) => listAbsences(childId, from, to);

// ── medicine (§3) ──
export type Dose = { id: string; time: string; label: string | null; givenAt: string | null; givenBy: string | null; givenByName: string | null; givenNote?: string | null; late: boolean };
export type Medicine = { id: string; childId: string; childName: string; classId: string; date: string; name: string; dose: string; note: string | null; photoUrl: string | null;
  doses: Dose[]; status: "active" | "cancelled"; createdBy: string | null; createdByName: string | null; createdAt: string; cancelledAt: string | null };
export const DOSE_PRESETS: [string, string][] = [["08:30", "Sau ăn sáng"], ["11:30", "Sau ăn trưa"], ["14:30", "Sau ngủ dậy"], ["15:30", "Sau ăn xế"]];
/** multipart: date?, name*, dose*, doses* = JSON [{time,label?}] (1–6, distinct), note?, photo? (JPG/PNG/HEIC). 400 VALIDATION_ERROR / SCHOOL_HOLIDAY. */
export const createMedicine = (childId: string, f: FormData) => http.upload<Medicine>(`/children/${childId}/medicines`, f);
/** Past instructions (read-only "Đã qua"): ?from&to. */
export const listMedicinesRange = (childId: string, from: string, to: string) => list<Medicine>(`/children/${childId}/medicines?from=${from}&to=${to}`);
export const listMedicines = (childId: string, date?: string) => list<Medicine>(`/children/${childId}/medicines${date ? "?date=" + date : ""}`);
/** Only while no dose given, else 409 DOSE_ALREADY_GIVEN. */
export const cancelMedicine = (id: string) => http.del<Medicine>(`/medicines/${id}`);
/** Atomic. 409 ALREADY_GIVEN (details.givenAt/givenByName), 409 MEDICINE_CANCELLED, 403 other class, 400 NOT_TODAY. */
export const markDoseGiven = (doseId: string, note?: string) => http.post<Medicine>(`/medicine-doses/${doseId}/given`, note ? { note } : {});
/** Photo needs auth: load via http.blobUrl(medicinePhoto(m)). */
export const medicinePhoto = (m: Medicine) => m.photoUrl ?? (m.id ? `/medicines/${m.id}/photo` : null);
export const MEDICINE_ERR: Record<string, string> = { ALREADY_GIVEN: "Liều này đã được cho uống", MEDICINE_CANCELLED: "Phụ huynh đã hủy dặn thuốc này",
  NOT_TODAY: "Chỉ đánh dấu được trong ngày uống thuốc", DATE_IN_PAST: "Không chọn ngày đã qua", DATE_TOO_FAR: "Chỉ dặn trước tối đa 30 ngày", NOT_SCHOOL_DAY: "Ngày cuối tuần, trường nghỉ", DOSE_ALREADY_GIVEN: "Đã cho uống ít nhất một liều, không hủy được", SCHOOL_HOLIDAY: "Ngày này trường nghỉ" };

// ── late pickup (§4) ──
export type LatePickup = { id: string; childId: string; childName: string; classId: string; date: string; time: string; pickerName: string | null; note: string | null;
  status: "active" | "cancelled"; createdBy: string | null; createdByName: string | null; createdAt: string; cancelledAt: string | null };
/** 400 OUTSIDE_SCHOOL_HOURS / TIME_PASSED / SCHOOL_HOLIDAY, 409 LATE_PICKUP_EXISTS (one active per child+date). */
export const requestLatePickup = (childId: string, b: { date: string; time: string; pickerName?: string; note?: string }) => http.post<LatePickup>(`/children/${childId}/late-pickups`, b);
export const listLatePickups = (childId: string, from?: string, to?: string) =>
  list<LatePickup>(`/children/${childId}/late-pickups?${new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v) as [string, string][])}`);
export const cancelLatePickup = (id: string) => http.del<LatePickup>(`/late-pickups/${id}`);
export const LATE_ERR: Record<string, string> = { OUTSIDE_SCHOOL_HOURS: "Ngoài giờ trường trông trẻ", TIME_PASSED: "Giờ đón đã qua", LATE_PICKUP_EXISTS: "Đã có báo đón muộn cho ngày này", DATE_IN_PAST: "Không chọn ngày đã qua", DATE_TOO_FAR: "Chỉ báo trước tối đa 30 ngày", NOT_SCHOOL_DAY: "Ngày cuối tuần, trường nghỉ", SCHOOL_HOLIDAY: "Ngày này trường nghỉ" };
/** Friendly text for any round-2 error code; falls back to the server message. */
export const msgErrorText = (e: unknown) => { const c = (e as { errorCode?: string })?.errorCode ?? "";
  return ABSENCE_ERR[c] ?? MEDICINE_ERR[c] ?? LATE_ERR[c] ?? HOLIDAY_ERR[c] ?? (e as Error)?.message ?? "Có lỗi xảy ra, vui lòng thử lại" };

// ── teacher: class feed pinned on top of Điểm danh (§6) ──
export type ClassMessages = { date: string; holiday: { id: string; name: string; kind?: Holiday["kind"]; reason?: string | null } | null; absences: Absence[]; medicines: Medicine[]; latePickups: LatePickup[];
  counts: { absences: number; medicines: number; dosesPending: number; latePickups: number } };
/** softGet: page keeps working (empty) if the route is missing. Server already returns only active items for that date. */
export async function classMessages(classId: string, date: string): Promise<ClassMessages> {
  const r = await softGet<Partial<ClassMessages>>(`/classes/${classId}/parent-messages?date=${date}`);
  const absences = r?.absences ?? [], medicines = r?.medicines ?? [], latePickups = r?.latePickups ?? [];
  return { date, holiday: r?.holiday ?? null, absences, medicines, latePickups,
    counts: r?.counts ?? { absences: absences.length, medicines: medicines.length, dosesPending: medicines.reduce((n, m) => n + m.doses.filter(d => !d.givenAt).length, 0), latePickups: latePickups.length } };
}
export const emptyClassMessages = (date: string): ClassMessages => ({ date, holiday: null, absences: [], medicines: [], latePickups: [], counts: { absences: 0, medicines: 0, dosesPending: 0, latePickups: 0 } });
/** Active (not cancelled, not overridden) on `date`. */
export const absentOn = (a: Absence, date: string) => a.status !== "cancelled" && a.from <= date && date <= a.to &&
  (a.days?.length ? a.days.some(d => d.date === date && !d.cancelled && !d.overridden) : !a.cancelledAt);

// ── dashboard (§8) ──
export type MedicineDue = { childId: string; fullName: string; classId: string; className: string | null; medicineId: string; medicineName: string; doseId: string; time: string; minutesLate: number };

// ── photo consent (§9) ──
export type PhotoConsent = { childId: string; consent: boolean; /** A2: parent has answered at least once */ asked?: boolean; hiddenPhotos?: number; /** alias */ photoConsent: boolean; updatedBy: { id: string; name: string } | null; updatedAt: string | null;
  history: { before: boolean | null; after: boolean; by: { id: string; name: string; role: string } | null; at: string; note: string | null; source: "api" | "import" }[] };
export const getPhotoConsent = (childId: string) => http.get<PhotoConsent>(`/children/${childId}/photo-consent`);
/** parent of own child, admin (teacher → 403). Only a real change is recorded (audit child.photo_consent). */
export const setPhotoConsent = (childId: string, consent: boolean, note?: string) => http.put<PhotoConsent>(`/children/${childId}/photo-consent`, note ? { consent, note } : { consent });

// ── daily notes extension ──
/** §7: `breakfast` uses the same scale as eating (all|most|half|little|none); toilet recommended values below (free text ≤ 40 still accepted). */
export const NOTE_BREAKFAST_FIELD = "breakfast";
export const TOILET: string[] = ["Bình thường", "Tiêu chảy", "Táo"];

// ── feature detection (Swagger) so pages degrade to "Sắp có" until the backend ships each endpoint ──
export type MsgFeatures = { absences: boolean; medicines: boolean; latePickups: boolean; classMessages: boolean; doseGiven: boolean; breakfast: boolean; photoConsent: boolean; holidays: boolean; overrideAbsence: boolean; any: boolean };
type Docs = { paths?: Record<string, unknown>; components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> } };
let feat: Promise<MsgFeatures> | null = null;
export function msgFeatures(): Promise<MsgFeatures> {
  feat ??= softGet<Docs>(API_ORIGIN + "/api/docs-json").then(d => {
    const paths = Object.keys(d?.paths ?? {}); const has = (re: RegExp) => paths.some(p => re.test(p));
    const f = { absences: has(/\/children\/\{[^}]+\}\/absences$/), medicines: has(/\/children\/\{[^}]+\}\/medicines$/), latePickups: has(/\/children\/\{[^}]+\}\/late-pickups$/),
      classMessages: has(/\/classes\/\{[^}]+\}\/parent-messages$/), doseGiven: has(/\/medicine-doses\/\{[^}]+\}\/given$/),
      // backend uses forbidNonWhitelisted: sending an unknown field (breakfast) would 400 → only show it once the DTO has it
      breakfast: !!d?.components?.schemas?.DailyNoteItemDto?.properties?.[NOTE_BREAKFAST_FIELD],
      overrideAbsence: Object.values(d?.components?.schemas ?? {}).some(x => !!x?.properties?.overrideAbsence),
      photoConsent: has(/\/children\/\{[^}]+\}\/photo-consent$/), holidays: has(/^\/api\/v1\/holidays$|^\/holidays$/) };
    return { ...f, any: f.absences || f.medicines || f.latePickups };
  });
  return feat;
}
