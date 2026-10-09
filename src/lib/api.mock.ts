// Mock client theo API tuần 1 (/api/v1). Đổi BASE + bỏ mock khi backend sẵn sàng.
import { users, classes, children, attendance } from "./mock";
import { ApiError, Paged, Child, Attendance, User } from "./types";
const delay = () => new Promise(r => setTimeout(r, 200));
let session: User | null = null; // access token giả lập; refresh token sẽ nằm trong cookie httpOnly ở backend thật
const need = () => { if (!session) throw new ApiError(401, "Chưa đăng nhập"); return session };
const canClass = (u: User, classId: string) => u.role === "admin" || u.role === "accountant" || u.classIds.includes(classId);
export const api = {
  async login(username: string, password: string) { await delay();
    const u = users.find(x => x.username === username && x.password === password);
    if (!u) throw new ApiError(401, "Sai tên đăng nhập hoặc mật khẩu");
    const user: User = { id: u.id, name: u.name, role: u.role, classIds: u.classIds, childIds: u.childIds }; session = user;
    if (typeof window !== "undefined") sessionStorage.setItem("me", JSON.stringify(user)); return user; },
  me(): User | null { if (!session && typeof window !== "undefined") { const s = sessionStorage.getItem("me"); session = s ? JSON.parse(s) : null } return session },
  logout() { session = null; sessionStorage.removeItem("me") },
  async classes() { await delay(); const u = need(); return classes.filter(c => canClass(u, c.id)) },
  async children(q: { page?: number; limit?: number; classId?: string; search?: string }): Promise<Paged<Child>> { await delay();
    const u = need(); const page = q.page ?? 1, limit = q.limit ?? 10;
    let list = children.filter(c => u.role === "parent" ? u.childIds.includes(c.id) : canClass(u, c.classId));
    if (q.classId) list = list.filter(c => c.classId === q.classId);
    if (q.search) list = list.filter(c => c.fullName.toLowerCase().includes(q.search!.toLowerCase()));
    return { items: list.slice((page - 1) * limit, page * limit), page, limit, total: list.length }; },
  async getAttendance(classId: string, date: string): Promise<Attendance[]> { await delay(); const u = need();
    if (!canClass(u, classId)) throw new ApiError(403, "Không có quyền với lớp này");
    return attendance[classId + date] ?? children.filter(c => c.classId === classId).map(c => ({ childId: c.id, status: "unset" as const })); },
  async putAttendance(classId: string, date: string, rows: Attendance[]) { await delay(); const u = need();
    if (!canClass(u, classId) || u.role === "accountant") throw new ApiError(403, "Không có quyền với lớp này");
    attendance[classId + date] = rows; return rows; },
};
