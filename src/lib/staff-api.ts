/** Quản lý giáo viên (mockups9). Backend: /staff/* (chấm công, ca làm, nghỉ phép, trông thay). Kiểu dữ liệu giữ nguyên như bản thiết kế. */
import { http, todayStr } from "./api";

export type AttStatus = "ok" | "late" | "leave" | "absent" | "sub" | "none";
export type AttDay = { date: string; checkIn?: string; checkOut?: string; status: AttStatus; subClass?: string;
  /** G6: loại nghỉ + nửa ngày (½ công) */ leaveType?: "sick" | "annual" | "personal"; half?: boolean };
export type StaffRow = { id: string; name: string; className: string; shift: string; days: AttDay[]; workDays: number; leaveDays: number };
export type Suggestion = { userId: string; name: string; freeNote: string };
export type Substitution = { date: string; className: string; absent: string; reason: string; kids: number; substitute?: string; suggestions: string[];
  /** ids needed to assign (POST /staff/substitutions) */
  shiftId?: string; classId?: string; absentUserId?: string; suggestionList?: Suggestion[] };
export type StaffWeek = { from: string; to: string; summary: { present: number; total: number; lateWeek: number; onLeave: number; needSub: number; /** H6: classes already covered this week */ covered: number }; rows: StaffRow[]; subs: Substitution[] };
export type MyToday = { date: string; shift: string; start: string; end: string; checkIn?: string; checkOut?: string; inSchool: boolean; sub?: { className: string; absent: string; reason: string }; week: AttDay[] };

type ApiStatus = "full" | "late" | "leave" | "absent" | "substitute" | "pending" | "off";
type ApiShift = { id: string; name: string; startTime: string; endTime: string } | null;
type ApiDay = { date: string; status: ApiStatus; checkInAt: string | null; checkOutAt?: string | null; shifts?: ApiShift[]; classes?: { id: string; name: string | null }[];
  substituteFor?: { className: string | null; absentUser: { name: string | null } | null }[];
  leaveType?: "sick" | "annual" | "personal" | null; leaveSession?: "full" | "morning" | "afternoon" | null; leaveDays?: number };
type ApiAttendance = { from: string; to: string; dates: string[];
  items: { user: { id: string; name: string }; days: ApiDay[]; totals: { workDays: number; leave: number } }[];
  summary: { present: number; totalStaff: number; leave: number; needSubstitute: number; range: { late: number; leave?: number } } };
type ApiNeed = { date: string; shift: ApiShift; class: { id: string; name: string | null; children: number }; absentTeachers: { id: string; name: string | null; reason: "leave" | "absent" }[]; suggestions: Suggestion[] };
type ApiToday = { date: string; shifts: ApiShift[]; checkInAt: string | null; checkOutAt: string | null; status: ApiStatus;
  substitutions: { role: "covering" | "covered"; class: { name: string | null } | null; absentTeacher: { name: string | null } | null; reason: string | null }[];
  week: { date: string; status: ApiStatus; checkInAt: string | null }[] };

const ST: Record<ApiStatus, AttStatus> = { full: "ok", late: "late", leave: "leave", absent: "absent", substitute: "sub", pending: "none", off: "none" };
const hm = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : undefined;
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) };
/** Monday of the week containing d */
export const mondayOf = (d: string) => { const wd = new Date(d + "T00:00:00Z").getUTCDay() || 7; return addDays(d, 1 - wd) };
/** H6: a planned substitution (future day, not yet checked in) still shows "↔ Trông thay <lớp>". */
const toDay = (d: ApiDay): AttDay => ({ date: d.date, status: d.substituteFor?.length && (d.status === "pending" || d.status === "off" || d.status === "full" || d.status === "late") ? "sub" : ST[d.status], checkIn: hm(d.checkInAt), checkOut: hm(d.checkOutAt), subClass: d.substituteFor?.[0]?.className ?? undefined,
  leaveType: d.leaveType ?? undefined, half: d.leaveDays === 0.5 });
const uniq = (xs: (string | null | undefined)[]) => Array.from(new Set(xs.filter(Boolean) as string[]));
const REASON = { leave: "nghỉ phép", absent: "vắng" } as const;

/** Tuần T2–T6 chứa `from` (mặc định tuần này). */
export async function getStaffWeek(from?: string): Promise<StaffWeek> {
  const mon = mondayOf(from || todayStr()), fri = addDays(mon, 4);
  const [a, n, cov] = await Promise.all([http.get<ApiAttendance>(`/staff/attendance?from=${mon}&to=${fri}`), http.get<{ items: ApiNeed[] }>(`/staff/substitutions/needs?from=${mon}&to=${fri}`),
    http.get<{ items: unknown[] }>(`/staff/substitutions?from=${mon}&to=${fri}`).catch(() => ({ items: [] }))]);
  const rows: StaffRow[] = a.items.filter(r => r.days.some(d => d.status !== "off") || r.totals.workDays > 0).map(r => ({
    id: r.user.id, name: r.user.name,
    className: uniq(r.days.flatMap(d => d.classes?.map(c => c.name) ?? [])).join(", ") || "—",
    shift: uniq(r.days.flatMap(d => d.shifts?.map(s => s?.name) ?? [])).join(", ") || "—",
    days: r.days.map(toDay), workDays: r.totals.workDays, leaveDays: r.totals.leave }));
  const subs: Substitution[] = n.items.map(x => ({
    date: x.date, className: x.class.name ?? "", kids: x.class.children,
    absent: x.absentTeachers.map(t => t.name).join(", "), reason: uniq(x.absentTeachers.map(t => REASON[t.reason])).join(", "),
    suggestions: x.suggestions.map(s => `${s.name} (${s.freeNote.toLowerCase()})`), suggestionList: x.suggestions,
    shiftId: x.shift?.id, classId: x.class.id, absentUserId: x.absentTeachers[0]?.id }));
  const s = a.summary;
  return { from: mon, to: fri, rows, subs, // H6: week view → leave days over the week (½ counted), uncovered classes over the week (not just the summary day)
    summary: { present: s.present, total: s.totalStaff, lateWeek: s.range.late, onLeave: s.range.leave ?? rows.reduce((t, r) => t + r.leaveDays, 0), needSub: subs.filter(x => !x.substitute).length, covered: cov.items.length } };
}

function toMy(t: ApiToday): MyToday {
  const sh = t.shifts.filter(Boolean) as NonNullable<ApiShift>[];
  const cov = t.substitutions.find(x => x.role === "covering");
  return { date: t.date, shift: sh.map(x => x.name).join(", ") || "Không có ca", start: sh[0]?.startTime ?? "", end: sh.map(x => x.endTime).sort().pop() ?? "",
    checkIn: hm(t.checkInAt), checkOut: hm(t.checkOutAt), inSchool: !!t.checkInAt && !t.checkOutAt,
    sub: cov ? { className: cov.class?.name ?? "", absent: cov.absentTeacher?.name ?? "", reason: cov.reason ?? "" } : undefined,
    week: t.week.map(d => ({ date: d.date, status: ST[d.status], checkIn: hm(d.checkInAt) })) };
}
export const getMyToday = async (): Promise<MyToday> => toMy(await http.get<ApiToday>("/staff/me/today"));
export const checkIn = async (): Promise<MyToday> => toMy(await http.post<ApiToday>("/staff/me/check-in", {}));
export const checkOut = async (): Promise<MyToday> => toMy(await http.post<ApiToday>("/staff/me/check-out", {}));
export const requestLeave = (fromDate: string, toDate: string, reason: string) => http.post("/staff/leaves", { fromDate, toDate, reason });
export const assignSubstitute = (x: Substitution, substituteUserId: string) =>
  http.post("/staff/substitutions", { date: x.date, shiftId: x.shiftId, classId: x.classId, absentUserId: x.absentUserId, substituteUserId, reason: x.reason });

export const ST_UI: Record<AttStatus, { cls: string; label: string }> = {
  ok: { cls: "bg-mint-100 text-mint-700", label: "Đủ" }, late: { cls: "bg-sun-100 text-ink-900", label: "Muộn" },
  leave: { cls: "bg-sky-100 text-sky-500", label: "Phép" }, absent: { cls: "bg-rose-100 text-rose-500", label: "Vắng" },
  sub: { cls: "bg-peach-100 text-peach-500", label: "Trông thay" }, none: { cls: "bg-ink-100 text-ink-500", label: "—" } };

/** G5: tên ca hiển thị là "Ca ngày" (dữ liệu cũ còn "Ca sáng"). */
export const shiftLabel = (s?: string) => (!s || /^ca sáng$/i.test(s.trim()) ? "Ca ngày" : s);
