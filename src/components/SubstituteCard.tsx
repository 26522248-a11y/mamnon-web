"use client";
/** P9 (mockups12 G8): thẻ "Thứ Hai cô Mai trông con" ở trang đầu phụ huynh.
 *  Nguồn: thông báo type "substitute_teacher" (data: substitutionId, classId, date, session, substituteName) – chỉ hiện hôm nay & các ngày tới của lớp bé. */
import { useEffect, useState } from "react";
import { http } from "@/lib/api";

type D = { substitutionId?: string; classId?: string; date?: string; session?: string; substituteName?: string };
type N = { id: string; type: string; data: D | null };
const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const SES: Record<string, string> = { morning: "buổi sáng", afternoon: "buổi chiều", full: "cả ngày" };
const dayText = (date: string, today: string) => {
  if (date === today) return "Hôm nay";
  const t = new Date(today + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  if (date === t.toISOString().slice(0, 10)) return "Ngày mai";
  return `${WD[new Date(date + "T00:00:00Z").getUTCDay()]} ${date.slice(8)}/${date.slice(5, 7)}`;
};

export function SubstituteCard({ classId, childName, today }: { classId?: string; childName: string; today: string }) {
  const [items, setItems] = useState<D[]>([]);
  useEffect(() => {
    if (!classId) return;
    http.get<{ items: N[] }>("/notifications?limit=50").then(p => {
      const seen = new Set<string>();
      setItems(p.items.filter(n => n.type === "substitute_teacher" && n.data?.date && n.data.date >= today && (!n.data.classId || n.data.classId === classId))
        .map(n => n.data as D).filter(d => { const k = d.substitutionId ?? `${d.date}${d.session}`; if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => a.date!.localeCompare(b.date!)).slice(0, 3));
    }).catch(() => setItems([]));
  }, [classId, today]);
  if (!items.length) return null;
  return <div className="space-y-2" data-testid="today-substitute">{items.map(d =>
    <div key={d.substitutionId ?? d.date} className="card border-l-4 border-peach-500 !p-4 text-[17px]">
      <b className="block text-peach-600">↔ {dayText(d.date!, today)} {d.substituteName ?? "cô trông thay"} trông {childName}</b>
      <span className="text-[15px] text-ink-500">{d.session && d.session !== "full" ? `Chỉ ${SES[d.session] ?? d.session}. ` : ""}Cô chủ nhiệm nghỉ, cô {d.substituteName?.replace(/^Cô\s+/i, "") ?? ""} đã nhận bàn giao lớp và dặn thuốc.</span>
    </div>)}</div>;
}
