"use client";
/** H4: a signed-in user opening "/" goes straight to their role's home; others go to /login. */
import { useRouter } from "next/navigation"; import { useEffect } from "react";
import { api, roleHome } from "@/lib/api";
export default function Home() {
  const r = useRouter();
  useEffect(() => { let m = null; try { m = api.me() } catch { /* not signed in */ } r.replace(roleHome(m)) }, [r]);
  return <main className="flex min-h-screen items-center justify-center text-ink-500" data-testid="home-redirect">Đang tải…</main>;
}
