"use client";
/** U7/U8: parent account page – name, relation, masked phone; links; logout last (full-width rose, confirm). */
import Link from "next/link"; import { useRouter } from "next/navigation"; import { useEffect, useState } from "react";
import { api } from "@/lib/api"; import { PhotoConsentChoice } from "@/components/PhotoConsentAsk"; import { useSchool } from "@/lib/school"; import { pickupPeople, pushState, subscribePush, PushState } from "@/lib/pickup-api";

const maskPhone = (p?: string | null) => { const d = (p ?? "").replace(/\D/g, ""); return d.length >= 7 ? `${d.slice(0, 3)} ••• ${d.slice(-3)}` : p || "Chưa có số"; };

export default function Account() {
  const r = useRouter(); const me = api.me(); const school = useSchool();
  const [mine, setMine] = useState<{ relation: string; phone: string | null; child: string } | null>(null);
  const [push, setPush] = useState<PushState | null>(null); const [pushErr, setPushErr] = useState("");
  useEffect(() => { const kid = me?.childIds?.[0]; if (!kid) return;
    Promise.all([pickupPeople(kid), api.children({ limit: 20 })]).then(([p, c]) => { const g = p.guardians.find(x => x.isMe);
      if (g) setMine({ relation: g.relation, phone: g.phone, child: c.items.find(x => x.id === kid)?.fullName.split(" ").pop() ?? "" }) }).catch(() => {}) }, [me?.childIds]);
  useEffect(() => { pushState().then(setPush).catch(() => setPush("unsupported")) }, []);
  if (!me) return null;
  const logout = async () => { if (!window.confirm("Bạn muốn đăng xuất?")) return; await api.logout(); r.push("/login") };
  const enable = async () => { setPushErr(""); try { setPush(await subscribePush()) } catch (e) { setPushErr((e as Error).message) } };
  const pushLabel = push === "subscribed" ? "Đang bật" : push === "denied" ? "Đã chặn trong trình duyệt" : push === "disabled" ? "Trường chưa bật" : push === "unsupported" ? "Máy này chưa hỗ trợ" : push ? "Chưa bật" : "…";
  const row = "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[17px]";
  return <div className="mx-auto max-w-md space-y-4 pb-4" data-testid="account-page">
    <h1 className="text-2xl font-bold">Tài khoản</h1>
    <div className="card flex items-center gap-4" data-testid="account-me"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-peach-100 text-2xl">👤</span>
      <div className="min-w-0"><div className="text-lg font-bold">{me.name}</div>
        <div className="text-[15px] text-ink-500">{mine ? `${mine.relation}${mine.child ? ` của bé ${mine.child}` : ""} · ${maskPhone(mine.phone)}` : "Phụ huynh"}</div></div></div>
    <PhotoConsentChoice />
    <div className="card divide-y divide-ink-100 !p-0" data-testid="account-links">
      <Link href="/pickups/delegates" className={row} data-testid="account-delegates"><span>🧑‍🤝‍🧑 Người đón hộ</span><span className="text-ink-300">›</span></Link>
      <Link href="/change-password?back=/account" className={row} data-testid="account-password"><span>🔑 Đổi mật khẩu</span><span className="text-ink-300">›</span></Link>
      <div className={row} data-testid="account-push"><span>🔔 Cài đặt thông báo<span className="block text-[15px] text-ink-500">{pushLabel}</span>{pushErr && <span className="block text-[15px] text-rose-500">{pushErr}</span>}</span>
        {push === "default" && <button className="btn min-h-12 shrink-0" onClick={enable} data-testid="account-push-enable">Bật</button>}</div>
      <Link href="/messages" className={row} data-testid="account-messages"><span>💬 Nhắn cô giáo</span><span className="text-ink-300">›</span></Link>
      <Link href="/photos" className={row}><span>📸 Ảnh lớp</span><span className="text-ink-300">›</span></Link>
      <Link href="/health" className={row}><span>📏 Sức khỏe</span><span className="text-ink-300">›</span></Link>
      {school?.phone && <a href={`tel:${school.phone.replace(/\s/g, "")}`} className={row} data-testid="account-call-school"><span>📞 Gọi cho trường<span className="block text-[15px] text-ink-500">{school.phone}</span></span><span className="text-ink-300">›</span></a>}
    </div>
    <button onClick={logout} data-testid="account-logout" className="min-h-14 w-full rounded-2xl border-2 border-rose-500 bg-white text-[17px] font-semibold text-rose-500">Đăng xuất</button>
  </div>;
}
