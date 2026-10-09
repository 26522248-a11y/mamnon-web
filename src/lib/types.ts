export type Role = "admin" | "teacher" | "accountant" | "parent";
export interface User { id: string; name: string; role: Role; classIds: string[]; childIds: string[]; mustChangePassword?: boolean }
export interface ClassRoom { id: string; name: string; ageGroup: string }
export interface Child { id: string; fullName: string; className?: string; dob: string; gender: "M" | "F"; classId: string; allergies?: string; status?: "active" | "withdrawn"; leaveDate?: string | null; photoUrl?: string | null;
  /** round2 §9 (absent before 2b ships) */ photoConsent?: boolean; photoConsentUpdatedAt?: string | null }
export type AttStatus = "unset" | "present" | "absent" | "late";
export interface Attendance { childId: string; fullName?: string; status: AttStatus; note?: string }
export interface Paged<T> { items: T[]; page: number; limit: number; total: number }
export class ApiError extends Error { constructor(public code: number, message: string, public details?: unknown, public errorCode?: string) { super(message) } }
