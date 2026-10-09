"use client";
/** Teacher: one medicine instruction with a "Đã cho uống" button per dose. Guarded against double taps; 409 = already given. */
import { useRef, useState } from "react";
import { Dose, markDoseGiven, Medicine, msgErrorText } from "@/lib/messages-api"; import { ApiError } from "@/lib/types";
import { hhmm, PersonPhoto } from "@/components/pickup-safety";

export function MedicineDoses({ m, onChange, canGive = true }: { m: Medicine; onChange: (m: Medicine | null) => void; canGive?: boolean }) {
  const inflight = useRef(new Set<string>()); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const give = async (d: Dose) => {
    if (d.givenAt || inflight.current.has(d.id)) return; // double-tap guard (sync, before any re-render)
    if (!confirm(`Xác nhận đã cho bé ${m.childName ?? ""} uống ${m.name} ${m.dose} (liều ${d.time})?`)) return;
    inflight.current.add(d.id); setBusy(d.id); setErr("");
    try { onChange(await markDoseGiven(d.id)) }
    catch (e) { const x = e as ApiError; const det = (x.details ?? {}) as { givenAt?: string; givenByName?: string };
      setErr(x.errorCode === "ALREADY_GIVEN" || (x.code === 409 && !x.errorCode) ? `Liều này đã được cho uống rồi${det.givenByName ? ` (${det.givenByName}${det.givenAt ? " lúc " + hhmm(det.givenAt) : ""})` : ""}.` : msgErrorText(x)); onChange(null) }
    finally { inflight.current.delete(d.id); setBusy(null) } };
  return <div className="space-y-2 rounded-2xl bg-white p-3" data-testid="medicine-card" data-id={m.id}>
    <div className="flex gap-3">{m.photoUrl && <PersonPhoto url={m.photoUrl} alt={m.name} className="h-16 w-16 shrink-0" />}
      <div className="text-sm"><b>💊 {m.childName}</b> · {m.name} · <b>{m.dose}</b>{m.note && <div className="text-ink-500">“{m.note}”</div>}</div></div>
    {m.doses.map(d => <div key={d.id} className={`flex min-h-12 items-center gap-2 rounded-xl px-3 ${d.givenAt ? "bg-mint-100" : d.late ? "bg-rose-100" : "bg-ink-100"}`} data-testid="dose-row" data-given={!!d.givenAt}>
      <span className="flex-1 text-sm">{d.label ? `${d.label} · ` : ""}<b>{d.time}</b>{!d.givenAt && d.late && <span className="text-rose-500"> · quá giờ</span>}{d.givenAt && <> · ✓ {d.givenByName ?? "Cô"} {hhmm(d.givenAt)}{d.givenNote ? ` · ${d.givenNote}` : ""}</>}</span>
      {!d.givenAt && canGive && <button className="min-h-12 rounded-xl bg-mint-500 px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy === d.id} onClick={() => give(d)} data-testid="dose-give">{busy === d.id ? "Đang lưu…" : "Đã cho uống"}</button>}
      {d.givenAt && <span className="rounded-full bg-mint-500 px-2 py-1 text-xs text-white">Đã uống</span>}</div>)}
    {err && <p className="text-sm text-rose-500">{err}</p>}</div>;
}
