"use client";
/** P9 (mockups12 G8): thẻ "Thứ Hai cô Mai trông con" ở trang đầu phụ huynh.
 *  Nguồn: GET /children/:id/substitutions – lượt trông thay thật (đã bỏ lượt xoá / đơn huỷ), hôm nay trở đi. */
import { useEffect, useState } from "react";
import { http } from "@/lib/api";

type D = { substitutionId?: string; classId?: string; date?: string; session?: string; substituteName?: string };
const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const SES: Record<string, string> = { morning: "buổi sáng", afternoon: "buổi chiều", full: "cả ngày" };
const dayText = (date: string, today: string) => {
  if (date === today) return "Hôm nay";
  const t = new Date(today + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  if (date === t.toISOString().slice(0, 10)) return "Ngày mai";
  return `${WD[new Date(date + "T00:00:00Z").getUTCDay()]} ${date.slice(8)}/${date.slice(5, 7)}`;
};

export function SubstituteCard({ childId, classId, childName, today }: { childId: string; classId?: string; childName: string; today: string }) {
  const [items, setItems] = useState<D[]>([]);
  useEffect(() => {
    if (!childId) return;
    http.get<{ items: D[] }>(`/children/${childId}/substitutions`).then(p => setItems((p.items ?? []).filter(d => d.date && d.date >= today && (!classId || d.classId === classId)).slice(0, 3))).catch(() => setItems([]));
  }, [childId, classId, today]);
  if (!items.length) return null;
  return <div className="space-y-2" data-testid="today-substitute">{items.map(d =>
    <div key={d.substitutionId ?? d.date} className="card border-l-4 border-peach-500 !p-4 text-[17px]">
      <b className="block text-peach-600">↔ {dayText(d.date!, today)} {d.substituteName ?? "cô trông thay"} trông {childName}</b>
      <span className="text-[15px] text-ink-500">{d.session && d.session !== "full" ? `Chỉ ${SES[d.session] ?? d.session}. ` : ""}Cô chủ nhiệm nghỉ, cô {d.substituteName?.replace(/^Cô\s+/i, "") ?? ""} đã nhận bàn giao lớp và dặn thuốc.</span>
    </div>)}</div>;
}
