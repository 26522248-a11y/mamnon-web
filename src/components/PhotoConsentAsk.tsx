"use client";
/** A2 (mockups13): hỏi phụ huynh "Cho cô đăng hình con lên nhóm lớp?" ngay lần đầu mở app – phải chọn mới đóng được, hỏi đúng một lần
 *  (backend `asked`); đổi lại ở Tài khoản (<PhotoConsentChoice>). Mỗi lần đổi backend ghi Lịch sử thay đổi (B18). */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getPhotoConsent, msgErrorText, msgFeatures, PhotoConsent, setPhotoConsent } from "@/lib/messages-api";

type KidC = { id: string; name: string; className: string | null; pc: PhotoConsent };
const when = (iso: string) => { const d = new Date(iso); const p = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-GB", { ...o, timeZone: "Asia/Ho_Chi_Minh" });
  return `${p({ hour: "2-digit", minute: "2-digit", hour12: false })}, ${p({ day: "2-digit", month: "2-digit" })}` };
const firstName = (n: string) => n.trim().split(/\s+/).pop() ?? n;

async function loadKids(): Promise<KidC[]> {
  const me = api.me(); if (me?.role !== "parent" || !me.childIds?.length) return [];
  if (!(await msgFeatures()).photoConsent) return [];
  const list = await api.children({ limit: 20 }).then(r => r.items).catch(() => []);
  const ids = me.childIds;
  const pcs = await Promise.all(ids.map(id => getPhotoConsent(id).catch(() => null)));
  return ids.map((id, i) => { const c = list.find(x => x.id === id); const pc = pcs[i];
    return pc ? { id, name: c?.fullName ?? "", className: c?.className ?? null, pc } : null }).filter(Boolean) as KidC[];
}

export function PhotoConsentAsk() {
  const [queue, setQueue] = useState<KidC[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { loadKids().then(ks => setQueue(ks.filter(k => k.pc.asked === false))).catch(() => {}) }, []);
  const k = queue[0];
  if (!k) return null;
  const answer = async (yes: boolean) => { setBusy(true); setErr("");
    try { await setPhotoConsent(k.id, yes); setQueue(q => q.slice(1)) } catch (e) { setErr(msgErrorText(e)) } finally { setBusy(false) } };
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/50 md:items-center" data-testid="consent-ask">
    <div role="dialog" aria-modal aria-labelledby="consent-ask-title" className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-6 pb-8 text-center md:rounded-3xl">
      <div className="text-4xl" aria-hidden>📸</div>
      <h2 id="consent-ask-title" className="text-xl font-bold">Cho cô đăng hình {queue.length > 1 || (api.me()?.childIds?.length ?? 0) > 1 ? `bé ${firstName(k.name)}` : "con"} lên nhóm lớp?</h2>
      <p className="text-[17px] text-ink-500">Chỉ phụ huynh trong lớp {k.className ?? "của bé"} xem được. Bạn đổi lại được bất cứ lúc nào ở mục Tài khoản.</p>
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}
      <button className="btn min-h-14 w-full text-[17px]" disabled={busy} onClick={() => answer(true)} data-testid="consent-yes">Có, cho đăng</button>
      <button className="min-h-14 w-full rounded-2xl border border-ink-100 bg-white text-[17px] font-semibold" disabled={busy} onClick={() => answer(false)} data-testid="consent-no">Không</button>
    </div></div>;
}

/** A2 · Tài khoản: "Cho cô đăng hình con lên nhóm lớp" ✓ Có / Không – bấm là lưu ngay, hiện "Đã lưu". */
export function PhotoConsentChoice() {
  const [kids, setKids] = useState<KidC[] | null>(null); const [saved, setSaved] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const load = useCallback(() => loadKids().then(setKids).catch(() => setKids([])), []);
  useEffect(() => { load() }, [load]);
  if (!kids?.length) return null;
  const set = async (k: KidC, yes: boolean) => { if (busy || (k.pc.asked && k.pc.consent === yes)) return; setBusy(k.id); setErr(""); setSaved(null);
    try { const pc = await setPhotoConsent(k.id, yes); setKids(ks => ks!.map(x => x.id === k.id ? { ...x, pc } : x)); setSaved(k.id) } catch (e) { setErr(msgErrorText(e)) } finally { setBusy(null) } };
  return <>{kids.map(k => { const on = k.pc.asked !== false ? k.pc.consent : null;
    return <div key={k.id} className="card space-y-3" data-testid="account-consent">
      <b className="block text-[17px]">Cho cô đăng hình {kids.length > 1 ? `bé ${firstName(k.name)}` : "con"} lên nhóm lớp</b>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cho cô đăng hình con lên nhóm lớp">
        <button role="radio" aria-checked={on === true} disabled={busy === k.id} onClick={() => set(k, true)} data-testid="account-consent-yes"
          className={`min-h-12 rounded-2xl border-2 text-[17px] font-semibold ${on === true ? "border-mint-500 bg-mint-500 text-white" : "border-ink-100 bg-white"}`}>{on === true ? "✓ Có" : "Có"}</button>
        <button role="radio" aria-checked={on === false} disabled={busy === k.id} onClick={() => set(k, false)} data-testid="account-consent-no"
          className={`min-h-12 rounded-2xl border-2 text-[17px] font-semibold ${on === false ? "border-ink-700 bg-ink-700 text-white" : "border-ink-100 bg-white"}`}>{on === false ? "✓ Không" : "Không"}</button></div>
      <p className="text-[15px] text-ink-500" data-testid="account-consent-when">{saved === k.id ? <span className="font-semibold text-mint-700">✓ Đã lưu · </span> : null}
        {k.pc.updatedAt ? `Đổi lúc ${when(k.pc.updatedAt)} · trường đã được báo` : "Chưa chọn"}
        {saved === k.id && (k.pc.hiddenPhotos ?? 0) > 0 ? ` · đã ẩn ${k.pc.hiddenPhotos} ảnh có bé` : ""}</p>
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}</div> })}</>;
}
