export const vnd = (n?: number | null) => (n ?? 0).toLocaleString("vi-VN") + "đ";
export const short = (n: number) => n >= 1e9 ? (n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tỷ" : n >= 1e6 ? (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr" : vnd(n);
export const vnTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "";
export const vnDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }) : "";
export const vnDate = (d?: string | null) => d ? d.slice(0, 10).split("-").reverse().join("/") : "";
export const thisMonth = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7);
export const addMonth = (p: string, n: number) => { const [y, m] = p.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
export const monthLabel = (p: string) => `Tháng ${Number(p.slice(5, 7))}/${p.slice(0, 4)}`;
