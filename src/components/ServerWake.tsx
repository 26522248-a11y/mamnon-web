"use client";
/** Only a network error / 5xx keeps waiting (max 60 s, then "Thử lại" or "Vẫn vào ứng dụng"); any other response lets the user in.
 * U1: Render (gói Free) ngủ → lần mở đầu chờ ~20–30 giây. Thay vì trang trắng: màn "Đang tải…" (tên trường + vòng xoay), báo đang khởi động, nút Thử lại. */
import { useCallback, useEffect, useRef, useState } from "react"; import { API_ORIGIN } from "@/lib/api";
const SHOW_AFTER = 700, SLOW_AFTER = 5000, GIVE_UP = 60000;
export function ServerWake() {
  const [state, setState] = useState<"ok" | "wait" | "slow" | "fail">("ok"); const [name, setName] = useState(""); const tries = useRef(0);
  const ping = useCallback(async () => {
    const n = ++tries.current; let done = false; const t0 = Date.now();
    const show = setTimeout(() => { if (!done) setState("wait") }, SHOW_AFTER); const slow = setTimeout(() => { if (!done) setState("slow") }, SLOW_AFTER);
    while (!done && Date.now() - t0 < GIVE_UP && n === tries.current) {
      try { const r = await fetch(`${API_ORIGIN}/api/v1/health/ping`, { cache: "no-store", signal: AbortSignal.timeout(20000) }); if (r.status < 500) done = true; /* server answered (even 404 on an older backend) → let the user in */ } catch { /* network error → retry */ }
      if (!done) await new Promise(r => setTimeout(r, 2000));
    }
    clearTimeout(show); clearTimeout(slow); if (n === tries.current) setState(done ? "ok" : "fail");
  }, []);
  useEffect(() => { try { const s = JSON.parse(sessionStorage.getItem("school") ?? "null"); setName(s?.name || localStorage.getItem("schoolName") || "") } catch { /* ignore */ } ping() }, [ping]);
  if (state === "ok") return null;
  return <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-cream p-6 text-center" role="status" aria-live="polite" data-testid="server-wake">
    <div className="text-5xl">🌱</div>
    {name && <div className="text-xl font-bold text-mint-700" data-testid="server-wake-school">{name}</div>}
    {state !== "fail" ? <><div className="h-10 w-10 animate-spin rounded-full border-4 border-mint-100 border-t-mint-500" aria-hidden />
      <div className="text-lg font-semibold">Đang tải…</div>
      {state === "slow" && <p className="max-w-xs text-ink-500" data-testid="server-wake-slow">Máy chủ đang khởi động, có thể mất khoảng 30 giây. Vui lòng đợi một chút.</p>}</>
      : <><p className="max-w-xs text-ink-500">Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.</p>
        <button className="btn min-h-12 px-6" onClick={() => { setState("wait"); ping() }} data-testid="server-wake-retry">Thử lại</button>
        <button className="min-h-12 px-6 text-mint-700 underline" onClick={() => { tries.current++; setState("ok") }} data-testid="server-wake-enter">Vẫn vào ứng dụng</button></>}
  </div>;
}
