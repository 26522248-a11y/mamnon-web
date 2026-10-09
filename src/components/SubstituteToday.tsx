"use client";
/** G8 (mockups12): cô trông thay – ghi chú bàn giao + "💊 Dặn thuốc hôm nay" của lớp trông thay; "✓ Đã cho uống" ghi giờ + báo phụ huynh. */
import { useCallback, useEffect, useState } from "react";
import { giveDose, mySubsToday, SESSION_UI, SubToday } from "@/lib/leave-api";

const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

export default function SubstituteToday() {
  const [d, setD] = useState<SubToday | null>(null); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("");
  const load = useCallback(() => mySubsToday().then(setD).catch(() => setD(null)), []);
  useEffect(() => { load() }, [load]);
  if (!d?.items.length) return null;
  const give = async (id: string) => { if (busy) return; setBusy(id); setErr(""); try { await giveDose(id); await load() } catch (e) { setErr((e as Error).message); await load() } finally { setBusy(null) } };
  return <>{d.items.map(s => <div key={s.substitutionId} className="space-y-2 rounded-2xl border border-peach-300 border-l-4 border-l-peach-500 bg-peach-50 p-3" data-testid="sub-today">
    <b className="text-[17px] text-peach-600">↔ Trông thay hôm nay · {s.class.name}</b>
    <p className="text-sm">{SESSION_UI[s.session]}{s.absentTeacher?.name ? ` · thay ${s.absentTeacher.name}` : ""}</p>
    <div className="rounded-xl bg-white p-3 text-sm" data-testid="sub-handover"><p className="text-xs text-ink-500">Ghi chú bàn giao lớp</p><p className="whitespace-pre-line">{s.handoverNote || "Không có ghi chú"}</p></div>
    <div className="space-y-2" data-testid="sub-meds"><b className="text-sm">💊 Dặn thuốc hôm nay</b>
      {s.medicines.length === 0 && <p className="text-sm text-ink-500">Không có dặn thuốc</p>}
      {s.medicines.map(m => <div key={m.id} className="rounded-xl bg-white p-3 text-sm"><p><b>{m.childName}</b> · {m.name}, {m.dose}</p>{m.note && <p className="text-xs text-ink-500">{m.note}</p>}
        <div className="mt-2 space-y-2">{m.doses.map(x => x.givenAt
          ? <div key={x.id} className="rounded-xl border border-mint-500 bg-mint-100 p-3 font-semibold text-mint-700" data-testid="dose-given">✓ {x.label ? `${x.label} · ` : ""}Đã cho uống lúc {hm(x.givenAt)} · đã báo phụ huynh{x.givenByName ? <span className="block text-xs font-normal">{x.givenByName}</span> : null}</div>
          : <button key={x.id} className="btn min-h-12 w-full" disabled={!!busy} onClick={() => give(x.id)} data-testid="btn-dose-give">{busy === x.id ? "Đang lưu…" : `✓ Đã cho uống${x.time ? ` (${x.time.slice(0, 5)}${x.label ? ` · ${x.label}` : ""})` : ""}`}</button>)}</div></div>)}
      {err && <p className="text-sm text-rose-500" role="alert">{err}</p>}</div>
  </div>)}</>;
}
