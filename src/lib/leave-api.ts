/** G6–G8: leave requests (types, half day), approval with substitute, substitute's day (handover note + class medicines). */
import { http } from "@/lib/api";

export type LeaveType = "sick" | "annual" | "personal";
export type LeaveSession = "full" | "morning" | "afternoon";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type Person = { id: string; name: string | null } | null;
export type LeaveSub = { id: string; date: string; session: LeaveSession; class: { id: string; name: string | null }; substituteTeacher: Person };
export type Leave = { id: string; userId: string; userName: string | null; classes: { id: string; name: string }[]; type: LeaveType; typeLabel: string; session: LeaveSession; sessionLabel: string;
  days: number; fromDate: string; toDate: string; reason?: string; handoverNote: string | null; status: LeaveStatus; decidedByName?: string | null; decisionNote?: string | null;
  substitutions: LeaveSub[]; createdAt?: string };
export type Suggestion = { userId: string; name: string; freeNote: string };
export type Coverage = { date: string; class: { id: string; name: string | null; children: number }; shift: { id: string; name: string; startTime: string; endTime: string } | null;
  substitution: { id: string; substituteTeacher: Person; session: LeaveSession } | null; suggestions: Suggestion[] };
export type LeaveDetail = Leave & { coverage?: Coverage[] };
export type Balance = { year: number; annualAllowance: number; annualUsed: number; annualPending: number; annualRemaining: number };
export type SubDose = { id: string; time: string; label: string | null; givenAt: string | null; givenByName: string | null };
export type SubMedicine = { id: string; childId: string; childName: string; name: string; dose: string; note: string | null; doses: SubDose[] };
export type SubToday = { date: string; items: { substitutionId: string; session: LeaveSession; class: { id: string; name: string | null }; absentTeacher: Person; handoverNote: string | null; medicines: SubMedicine[] }[] };

export const TYPE_UI: Record<LeaveType, { icon: string; label: string; cls: string; on: string }> = {
  sick: { icon: "🤒", label: "Ốm", cls: "bg-rose-100 text-rose-600", on: "border-rose-500 bg-rose-100" },
  annual: { icon: "🌴", label: "Phép năm", cls: "bg-sky-100 text-sky-500", on: "border-sky-500 bg-sky-100" },
  personal: { icon: "📝", label: "Việc riêng", cls: "bg-sun-100 text-ink-900", on: "border-sun-500 bg-sun-100" },
};
export const SESSION_UI: Record<LeaveSession, string> = { full: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" };
export const STATUS_UI: Record<LeaveStatus, { cls: string; label: string; short: string }> = {
  pending: { cls: "border-sun-500 bg-sun-100", label: "⏳ Chờ Ban giám hiệu duyệt", short: "Chờ duyệt" }, approved: { cls: "border-mint-500 bg-mint-100", label: "✓ Đã duyệt", short: "✓ Đã duyệt" },
  rejected: { cls: "border-rose-500 bg-rose-100", label: "Bị từ chối", short: "Bị từ chối" }, cancelled: { cls: "border-ink-300 bg-ink-100", label: "Đã huỷ", short: "Đã huỷ" },
};
export const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const leaveWhen = (l: { fromDate: string; toDate: string; session: LeaveSession }) =>
  `${l.fromDate === l.toDate ? dm(l.fromDate) : `${dm(l.fromDate)} – ${dm(l.toDate)}`}${l.session === "full" ? "" : ` · ${SESSION_UI[l.session].toLowerCase()}`}`;
export const fmtDays = (n: number) => String(n).replace(".", ",");

export const sendLeave = (b: { type: LeaveType; fromDate: string; toDate: string; session: LeaveSession; reason?: string; handoverNote?: string }) => http.post<Leave>("/staff/leaves", b);
export const myLeaves = (q = "") => http.get<{ items: Leave[] }>(`/staff/leaves${q}`).then(r => r.items);
export const leaveDetail = (id: string) => http.get<LeaveDetail>(`/staff/leaves/${id}`);
export const leaveBalance = () => http.get<Balance>("/staff/leaves/balance");
export const leavePreview = (fromDate: string, toDate: string, session: LeaveSession) =>
  http.get<{ days: number }>(`/staff/leaves/preview?fromDate=${fromDate}&toDate=${toDate}&session=${session}`);
export const approveLeave = (id: string, b: { note?: string; substituteUserId?: string; substitutions?: { date: string; classId: string; shiftId?: string; substituteUserId: string }[] }) =>
  http.post<Leave>(`/staff/leaves/${id}/approve`, b);
export const rejectLeave = (id: string, note: string) => http.post<Leave>(`/staff/leaves/${id}/reject`, { note });
export const patchLeave = (id: string, handoverNote: string) => http.patch<Leave>(`/staff/leaves/${id}`, { handoverNote });
export const mySubsToday = () => http.get<SubToday>("/staff/me/substitutions/today");
export const giveDose = (doseId: string) => http.post<{ doses: SubDose[] }>(`/medicine-doses/${doseId}/given`, {});
