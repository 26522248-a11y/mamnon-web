/** Thu chi tổng (mockups9). Dữ liệu MẪU cho tới khi có API thật – dev chỉ cần thay getFinance. */
export type Txn = { id: string; date: string; title: string; amount: number; kind: "in" | "out"; by?: string; auto?: boolean; hasReceipt?: boolean; pending?: boolean };
export type Finance = { month: string; totalIn: number; totalOut: number; prevDiffPct: number; inBreakdown: string; outBreakdown: string; groups: { name: string; amount: number }[]; txns: Txn[] };
const MOCK: Finance = { month: "2026-10", totalIn: 186_400_000, totalOut: 142_900_000, prevDiffPct: 6, inBreakdown: "Học phí 172tr · Khác 14,4tr", outBreakdown: "Lương 98tr · Ăn 31tr · Khác",
  groups: [{ name: "Lương & BH", amount: 98_000_000 }, { name: "Tiền ăn", amount: 31_200_000 }, { name: "Điện nước", amount: 8_400_000 }, { name: "Đồ dùng học tập", amount: 5_300_000 }],
  txns: [{ id: "1", date: "2026-10-09", title: "Mua rau, thịt tuần 2", amount: 6_200_000, kind: "out", by: "ketoan", hasReceipt: true },
    { id: "2", date: "2026-10-09", title: "Học phí · 8 bé (QR)", amount: 19_600_000, kind: "in", auto: true },
    { id: "3", date: "2026-10-08", title: "Sửa máy lạnh lớp Lá 1 + Chồi 2", amount: 12_500_000, kind: "out", by: "ketoan", pending: true },
    { id: "4", date: "2026-10-08", title: "Tiền điện T9", amount: 5_100_000, kind: "out", by: "ketoan" }] };
export const getFinance = async (_month?: string): Promise<Finance> => MOCK;
export const APPROVAL_LIMIT = 10_000_000;
