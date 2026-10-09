export type Eat = "all" | "most" | "half" | "little" | "none";
export const EAT: [Eat, string][] = [["all", "Hết suất"], ["most", "Gần hết"], ["half", "Một nửa"], ["little", "Ít"], ["none", "Không ăn"]];
export const MOODS: [string, string][] = [["Vui vẻ", "😄"], ["Bình thường", "🙂"], ["Quấy khóc", "😢"], ["Mệt", "🤒"]];
export const sleepText = (m: number | null) => m == null ? "" : m === 0 ? "Không ngủ" : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
