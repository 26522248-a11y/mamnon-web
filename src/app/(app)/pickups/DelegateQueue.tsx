"use client";
/** Admin: delegates registered by parents waiting for school approval. One-tap approve; reject needs a reason. */
import { fmtDate } from "@/lib/date"; import { useCallback, useEffect, useState } from "react";
import { approveDelegate, Delegate, DELEGATE_REJECT_PRESETS, idLast4, listDelegates, rejectDelegate } from "@/lib/pickup-api";
import { hhmm, PersonPhoto, ReasonBox } from "@/components/pickup-safety";

export function DelegateQueue() {
  const [ds, setDs] = useState<Delegate[] | null>(null); const [err, setErr] = useState("");
  const load = useCallback(() => listDelegates({ status: "pending" }).then(setDs).catch(e => setErr(e.message)), []);
  useEffect(() => { load() }, [load]);
  if (!ds?.length && !err) return null;
  return <section className="card space-y-3" data-testid="delegate-queue"><h2 className="text-lg font-bold">Người đón hộ chờ duyệt <span className="rounded-full bg-sun-100 px-2 text-sm">{ds?.length ?? 0}</span></h2>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    <div className="grid gap-3 md:grid-cols-2">{ds?.map(d => <Row key={d.id} d={d} onChange={load} />)}</div></section>;
}
function Row({ d, onChange }: { d: Delegate; onChange: () => void }) {
  const [rej, setRej] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const run = async (f: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await f(); onChange() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } };
  return <div className="space-y-2 rounded-2xl border-2 border-sun-500 p-3" data-testid="delegate-pending">
    <div className="flex gap-3"><PersonPhoto url={d.photoUrl} alt={d.fullName} className="h-24 w-20 shrink-0" />
      <div className="text-sm"><b className="text-base">{d.fullName}</b>{d.relation && ` (${d.relation})`}<div>đón hộ bé <b>{d.childName}</b></div>
        <div className="text-ink-500">Căn cước {idLast4(d.idNumberMasked)}</div><div className="text-ink-500">① {d.phone1}{d.phone2 && ` · ② ${d.phone2}`}</div>
        <div className="text-xs text-ink-500">{d.createdByName} gửi {hhmm(d.createdAt)} {fmtDate(d.createdAt)}</div></div></div>
    {err && <p className="text-sm text-rose-500">{err}</p>}
    {rej ? <ReasonBox presets={DELEGATE_REJECT_PRESETS} busy={busy} onCancel={() => setRej(false)} onSubmit={n => run(() => rejectDelegate(d.id, n))} />
      : <div className="grid grid-cols-2 gap-2"><button className="min-h-12 rounded-xl border-2 border-rose-500 font-semibold text-rose-500" onClick={() => setRej(true)} data-testid="delegate-reject">Từ chối…</button>
        <button className="min-h-12 rounded-xl bg-mint-500 font-semibold text-white" disabled={busy} onClick={() => run(() => approveDelegate(d.id))} data-testid="delegate-approve">Duyệt ✓</button></div>}</div>;
}
