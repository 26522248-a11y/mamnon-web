import { User, ClassRoom, Child, Attendance } from "./types";
export const users: (User & { username: string; password: string })[] = [
  { id: "u1", username: "admin", password: "123456", name: "Cô Hiệu trưởng", role: "admin", classIds: [], childIds: [] },
  { id: "u2", username: "gv1", password: "123456", name: "Cô Lan", role: "teacher", classIds: ["c1"], childIds: [] },
  { id: "u3", username: "ketoan", password: "123456", name: "Chị Kế toán", role: "accountant", classIds: [], childIds: [] },
  { id: "u4", username: "ph1", password: "123456", name: "Phụ huynh bé An", role: "parent", classIds: [], childIds: ["k1"] },
];
export const classes: ClassRoom[] = [
  { id: "c1", name: "Mầm 1", ageGroup: "3-4 tuổi" }, { id: "c2", name: "Chồi 1", ageGroup: "4-5 tuổi" },
  { id: "c3", name: "Lá 1", ageGroup: "5-6 tuổi" },
];
const ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ"]; const ten = ["An", "Bình", "Chi", "Dũng", "Hà", "Khôi", "Linh", "Minh", "Ngọc", "Phúc"];
export const children: Child[] = Array.from({ length: 60 }, (_, i) => ({
  id: "k" + (i + 1), fullName: `${ho[i % 6]} ${["Gia", "Minh", "Bảo", "Khánh"][i % 4]} ${ten[i % 10]}`,
  dob: `20${20 + (i % 3)}-0${(i % 9) + 1}-1${i % 9}`, gender: i % 2 ? "F" : "M", classId: classes[i % 3].id,
  allergies: i % 7 === 0 ? "Đậu phộng" : undefined,
}));
export const attendance: Record<string, Attendance[]> = {};
