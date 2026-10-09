"use client";
/** U7: parent bottom nav – its own component, exactly 5 items, no "Thêm". Pages outside the 5 map to the closest tab so a way back is always lit. */
import Link from "next/link";

export const PARENT_TABS = [
  { href: "/today", label: "Hôm nay", icon: "🌞", also: ["/menu", "/health", "/children", "/photos"] },
  { href: "/pickups", label: "Đón bé", icon: "🚸", also: [] },
  { href: "/fees", label: "Học phí", icon: "💰", also: [] },
  { href: "/notifications", label: "Thông báo", icon: "🔔", also: [] },
  { href: "/account", label: "Tài khoản", icon: "👤", also: ["/messages"] },
] as const;

export const parentTabFor = (path: string) => PARENT_TABS.find(t => [t.href, ...t.also].some(h => path === h || path.startsWith(h + "/")))?.href ?? null;

export default function ParentNav({ path }: { path: string }) {
  const active = parentTabFor(path);
  return <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden" data-testid="parent-nav" aria-label="Menu phụ huynh">
    {PARENT_TABS.map(t => { const on = active === t.href;
      return <Link key={t.href} href={t.href} data-testid={`parent-tab-${t.href.slice(1)}`} aria-current={on ? "page" : undefined}
        className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[15px] leading-tight tracking-tight ${on ? "font-bold text-mint-700" : "text-ink-500"}`}>
        <span className={`flex h-7 w-12 items-center justify-center rounded-full text-xl ${on ? "bg-mint-100" : ""}`} aria-hidden>{t.icon}</span>{t.label}</Link> })}
  </nav>;
}
