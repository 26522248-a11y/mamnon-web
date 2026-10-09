"use client";
import Link from "next/link"; import { usePathname, useRouter } from "next/navigation"; import { useEffect, useState } from "react";
import { api } from "@/lib/api"; import { APP_NAME, useSchool } from "@/lib/school"; import { Role, User } from "@/lib/types";
const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/today", label: "Bé hôm nay", icon: "🌞", roles: ["parent"] },
  { href: "/dashboard", label: "Tổng quan", icon: "🏠", roles: ["admin", "accountant"] },
  { href: "/children", label: "Hồ sơ trẻ", icon: "🧒", roles: ["admin", "teacher", "accountant", "parent"] },
  { href: "/attendance", label: "Điểm danh", icon: "✅", roles: ["admin", "teacher"] },
  { href: "/pickups", label: "Đón bé", icon: "🚸", roles: ["admin", "teacher", "parent"] },
  { href: "/fees", label: "Học phí", icon: "💰", roles: ["admin", "accountant", "parent"] },
  { href: "/health", label: "Sức khỏe", icon: "📏", roles: ["admin", "teacher", "parent"] },
  { href: "/menu", label: "Thực đơn", icon: "🍚", roles: ["admin", "teacher", "parent"] },
  { href: "/notes", label: "Nhật ký", icon: "📝", roles: ["admin", "teacher"] },
  { href: "/notifications", label: "Thông báo", icon: "🔔", roles: ["admin", "teacher", "accountant", "parent"] },
  { href: "/announcements", label: "Soạn tin", icon: "📣", roles: ["admin", "teacher"] },
  { href: "/reports", label: "Báo cáo", icon: "📊", roles: ["admin", "accountant"] },
  { href: "/users", label: "Tài khoản", icon: "👥", roles: ["admin"] },
  { href: "/import", label: "Nhập Excel", icon: "📥", roles: ["admin"] },
  { href: "/pickups", label: "Trực đón", icon: "🛡️", roles: ["accountant"] },
  { href: "/messages", label: "Nhắn cô", icon: "💬", roles: ["parent"] },
  { href: "/audit", label: "Nhật ký thao tác", icon: "🗂️", roles: ["admin"] },
  { href: "/sensitive-changes", label: "Lịch sử thay đổi", icon: "🔐", roles: ["admin"] },
  { href: "/finance", label: "Thu chi", icon: "💵", roles: ["admin", "accountant"] },
  { href: "/staff", label: "Chấm công", icon: "🕘", roles: ["admin", "teacher"] },
  { href: "/holidays", label: "Lịch nghỉ", icon: "🏖️", roles: ["admin"] },
  { href: "/photos", label: "Ảnh lớp", icon: "📸", roles: ["admin", "teacher", "parent"] },
];
/** Tab dưới cùng trên mobile (tối đa 4 + "Thêm"); các mục còn lại nằm trong sheet "Thêm". */
const MOBILE_TABS: Record<Role, string[]> = {
  parent: ["/today", "/pickups", "/fees", "/notifications"],
  teacher: ["/attendance", "/notes", "/pickups", "/notifications"],
  admin: ["/dashboard", "/attendance", "/pickups", "/notifications"],
  accountant: ["/dashboard", "/fees", "/reports", "/notifications"],
};
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter(); const path = usePathname(); const [me, setMe] = useState<User | null>(null); const [more, setMore] = useState(false); const school = useSchool();
  useEffect(() => { setMore(false) }, [path]);
  useEffect(() => { const m = api.me(); if (!m) { r.replace("/login"); return } if (m.mustChangePassword) { r.replace("/change-password"); return } const ok = NAV.filter(n => n.roles.includes(m.role)); if (!ok.some(n => path.startsWith(n.href))) { r.replace(ok[0].href); return } setMe(m) }, [r, path]);
  if (!me || !NAV.some(n => n.roles.includes(me.role) && path.startsWith(n.href))) return null; const nav = NAV.filter(n => n.roles.includes(me.role));
  const want = MOBILE_TABS[me.role] ?? []; const tabs = want.map(h => nav.find(n => n.href === h)).filter((n): n is (typeof nav)[number] => !!n).slice(0, 4);
  const rest = nav.filter(n => !tabs.includes(n));
  return <div className="md:flex">
    <aside className="hidden print:!hidden md:flex md:min-h-screen md:w-60 md:flex-col md:bg-white md:p-4">
      <div className="mb-6 text-xl font-bold text-mint-700">🌱 {school?.name || APP_NAME}</div>
      {nav.map(n => <Link key={n.href} href={n.href} className={`mb-1 rounded-2xl px-4 py-3 ${path.startsWith(n.href) ? "bg-mint-100 font-semibold text-mint-700" : "hover:bg-mint-50"}`}>{n.icon} {n.label}</Link>)}
      <div className="mt-auto text-sm text-ink-500">{me.name}<button onClick={async () => { await api.logout(); r.push("/login") }} className="block text-peach-500">Đăng xuất</button></div>
    </aside>
    <main className="flex-1 p-4 pb-24 md:p-8">{children}</main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" data-testid="mobile-nav">
      {tabs.map(n => <Link key={n.href} href={n.href} data-testid={`nav-tab-${n.href.slice(1)}`} className={`flex min-h-14 flex-1 flex-col items-center justify-center py-1 text-[11px] ${path.startsWith(n.href) && !more ? "font-semibold text-mint-700" : "text-ink-500"}`}><div className="text-xl">{n.icon}</div>{n.label}</Link>)}
      <button onClick={() => setMore(!more)} data-testid="nav-more" aria-expanded={more} className={`flex min-h-14 flex-1 flex-col items-center justify-center py-1 text-[11px] ${more || rest.some(n => path.startsWith(n.href)) ? "font-semibold text-mint-700" : "text-ink-500"}`}><div className="text-xl">☰</div>Thêm</button>
    </nav>
    {more && <div className="fixed inset-0 z-20 bg-ink-900/30 md:hidden print:hidden" onClick={() => setMore(false)}>
      <div className="absolute inset-x-0 bottom-14 rounded-t-3xl bg-white p-4 pb-6 shadow-card" onClick={e => e.stopPropagation()} data-testid="more-sheet">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-100" />
        <div className="grid grid-cols-3 gap-2">{rest.map(n => <Link key={n.href} href={n.href} className={`flex min-h-20 flex-col items-center justify-center rounded-2xl text-sm ${path.startsWith(n.href) ? "bg-mint-100 font-semibold text-mint-700" : "bg-ink-100/50"}`}><div className="text-2xl">{n.icon}</div>{n.label}</Link>)}</div>
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm"><span className="text-ink-500">{me.name}</span>
          <button className="min-h-12 px-3 font-semibold text-peach-500" data-testid="btn-logout-mobile" onClick={async () => { await api.logout(); r.push("/login") }}>Đăng xuất</button></div></div></div>}</div>;
}
