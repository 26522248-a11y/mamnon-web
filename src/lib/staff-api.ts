/** Quản lý giáo viên (mockups9). Dữ liệu MẪU cho tới khi có API thật – dev chỉ cần thay 2 hàm dưới. */
export type AttStatus = "ok" | "late" | "leave" | "absent" | "sub" | "none";
export type AttDay = { date: string; checkIn?: string; checkOut?: string; status: AttStatus; subClass?: string };
export type StaffRow = { id: string; name: string; className: string; shift: string; days: AttDay[]; workDays: number; leaveDays: number };
export type Substitution = { date: string; className: string; absent: string; reason: string; kids: number; substitute?: string; suggestions: string[] };
export type StaffWeek = { from: string; to: string; summary: { present: number; total: number; lateWeek: number; onLeave: number; needSub: number }; rows: StaffRow[]; subs: Substitution[] };
export type MyToday = { date: string; shift: string; start: string; end: string; checkIn?: string; checkOut?: string; inSchool: boolean; sub?: { className: string; absent: string; reason: string }; week: AttDay[] };

const D = ["2026-10-06","2026-10-07","2026-10-08","2026-10-09","2026-10-10"];
const day = (i: number, status: AttStatus, checkIn?: string, subClass?: string): AttDay => ({ date: D[i], status, checkIn, subClass });
const MOCK: StaffWeek = { from: D[0], to: D[4], summary: { present: 11, total: 12, lateWeek: 3, onLeave: 1, needSub: 1 },
  rows: [
    { id: "1", name: "Cô Lan", className: "Mầm 1", shift: "Ca sáng", workDays: 5, leaveDays: 0, days: [day(0,"ok","06:58"),day(1,"ok","07:01"),day(2,"late","07:22"),day(3,"ok","06:55"),day(4,"ok","06:59")] },
    { id: "2", name: "Cô Hoa", className: "Chồi 1", shift: "Ca sáng", workDays: 3, leaveDays: 2, days: [day(0,"ok","06:50"),day(1,"ok","06:57"),day(2,"ok","07:00"),day(3,"leave"),day(4,"leave")] },
    { id: "3", name: "Cô Mai", className: "Lá 1", shift: "Ca chiều", workDays: 3, leaveDays: 0, days: [day(0,"ok","10:58"),day(1,"absent"),day(2,"ok","11:00"),day(3,"sub",undefined,"Chồi 1"),day(4,"none")] },
  ],
  subs: [{ date: D[4], className: "Chồi 1", absent: "Cô Hoa", reason: "nghỉ phép", kids: 24, suggestions: ["Cô Mai (rảnh ca sáng)", "Cô Thu (bảo mẫu)"] }] };
const MY: MyToday = { date: D[4], shift: "Ca sáng", start: "07:00", end: "16:00", inSchool: true, sub: { className: "Chồi 1", absent: "Cô Hoa", reason: "nghỉ phép" },
  week: [day(0,"ok","06:58"),day(1,"ok","07:01"),day(2,"late","07:22"),day(3,"ok","06:55"),day(4,"none")] };

export const getStaffWeek = async (_from?: string): Promise<StaffWeek> => MOCK;
export const getMyToday = async (): Promise<MyToday> => MY;

export const ST_UI: Record<AttStatus, { cls: string; label: string }> = {
  ok: { cls: "bg-mint-100 text-mint-700", label: "Đủ" }, late: { cls: "bg-sun-100 text-ink-900", label: "Muộn" },
  leave: { cls: "bg-sky-100 text-sky-500", label: "Phép" }, absent: { cls: "bg-rose-100 text-rose-500", label: "Vắng" },
  sub: { cls: "bg-peach-100 text-peach-500", label: "Trông thay" }, none: { cls: "bg-ink-100 text-ink-500", label: "—" } };
