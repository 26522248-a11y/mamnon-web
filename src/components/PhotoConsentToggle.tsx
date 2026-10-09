"use client";
/** Child profile: "Cho phép đăng ảnh bé trong album lớp" (round2 §9). Default off. Parent of child + admin can change; others read-only.
 *  Turning ON asks one confirm; OFF is immediate. Hidden until the backend ships /children/:id/photo-consent (feature-detect). */
import { useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/date"; import { getPhotoConsent, msgErrorText, msgFeatures, PhotoConsent, setPhotoConsent } from "@/lib/messages-api";

const when = (iso: string) => fmtDateTime(iso);

export function PhotoConsentToggle({ childId, canEdit }: { childId: string; canEdit: boolean }) {
  const [on, setOn] = useState<boolean | null>(null); const [pc, setPc] = useState<PhotoConsent | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { let live = true;
    msgFeatures().then(f => f.photoConsent ? getPhotoConsent(childId).then(x => { if (live) { setPc(x); setOn(x.consent ?? x.photoConsent) } }) : null).catch(() => {});
    return () => { live = false } }, [childId]);
  if (on === null || !pc) return null;
  const flip = async () => { if (!canEdit || busy) return; const next = !on;
    if (next && !confirm("Cho phép nhà trường đăng ảnh có bé trong album lớp? Bố mẹ có thể tắt lại bất cứ lúc nào.")) return;
    setBusy(true); setErr(""); try { const x = await setPhotoConsent(childId, next); setPc(x); setOn(x.consent ?? x.photoConsent) } catch (e) { setErr(msgErrorText(e)) } finally { setBusy(false) } };
  const by = pc.updatedBy?.name ?? null;
  return <div className="card space-y-1" data-testid="photo-consent">
    <button type="button" role="switch" aria-checked={on} disabled={!canEdit || busy} onClick={flip} data-testid="photo-consent-toggle"
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left disabled:cursor-default">
      <span className="font-medium">Cho cô đăng hình con lên nhóm lớp</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-mint-500" : "bg-ink-300"} ${busy ? "opacity-50" : ""}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span></button>
    {on ? (pc.updatedAt && <p className="text-xs text-mint-700" data-testid="photo-consent-by">Bật bởi {by ?? "—"} lúc {when(pc.updatedAt)}</p>)
      : <p className="text-xs text-ink-500" data-testid="photo-consent-off">Ảnh có bé sẽ không được đăng{pc.updatedAt && by ? ` · Tắt bởi ${by} lúc ${when(pc.updatedAt)}` : ""}</p>}
    {!canEdit && <p className="text-xs text-ink-500">Chỉ phụ huynh hoặc Ban giám hiệu thay đổi được.</p>}
    {err && <p className="text-sm text-rose-500">{err}</p>}</div>;
}
