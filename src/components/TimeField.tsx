"use client";
/**
 * 24h time input "HH:MM" regardless of browser locale (native type=time shows AM/PM on some devices).
 * Typing digits auto-inserts ":" ("930" → "09:30" on blur, "1130" → "11:30"). Valid 00:00–23:59 within min/max, Vietnamese errors.
 * Clock icon opens the native picker (hidden <input type="time">). Controlled (value + onChange("HH:MM" | "")) or in a form (name + defaultValue).
 */
import { useEffect, useRef, useState } from "react";

type Props = { value?: string; defaultValue?: string; onChange?: (hhmm: string) => void; name?: string; min?: string; max?: string; required?: boolean;
  className?: string; placeholder?: string; disabled?: boolean; "data-testid"?: string; "aria-label"?: string; id?: string };

/** "9:5" / "0930" / "09:30" → "09:30", or null if not a real 24h time. */
export function parseHHMM(s: string): string | null {
  const t = s.trim(); const m = /^(\d{1,2}):(\d{1,2})$/.exec(t) ?? /^(\d{2})(\d{2})$/.exec(t) ?? /^(\d)(\d{2})$/.exec(t);
  if (!m) return null; const h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}
const mask = (raw: string) => { if (/^\d{1,2}:\d{0,2}$/.test(raw)) return raw; const d = raw.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d };

export function TimeField({ value, defaultValue, onChange, name, min, max, required, className = "", placeholder = "HH:MM", disabled, id, ...aria }: Props) {
  const controlled = value !== undefined;
  const [v, setV] = useState(controlled ? value! : defaultValue ?? ""); const [text, setText] = useState(v); const [bad, setBad] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => { if (controlled && value !== v) { setV(value!); setText(value!); setBad("") } }, [controlled, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const check = (t: string | null) => !t ? "Giờ không hợp lệ (00:00 – 23:59)" : min && t < min ? `Không sớm hơn ${min}` : max && t > max ? `Không muộn hơn ${max}` : "";
  const accept = (t: string) => { setV(t); setText(t); setBad(""); onChange?.(t) };
  const settle = (t: string, final: boolean) => { const p = parseHHMM(t); const e = check(p);
    if (!e && p) { if (p !== v || final) accept(p) } else if (final || t.length >= 5) setBad(e) };
  const typed = (raw: string) => { const t = mask(raw); setText(t); setBad("");
    if (!t) { if (v) { setV(""); onChange?.("") } return }
    if (t.length === 5) settle(t, false) };
  const open = () => { const el = pick.current; if (!el || disabled) return; try { el.showPicker() } catch { el.focus(); el.click() } };
  return <div className={`relative ${className}`}>
    <input type="text" inputMode="numeric" autoComplete="off" className={`input pr-12 ${bad ? "!border-rose-500" : ""}`} placeholder={placeholder} value={text} id={id}
      onChange={e => typed(e.target.value)} onBlur={() => { if (text) settle(text, true) }} required={required} disabled={disabled} maxLength={5} aria-invalid={!!bad || undefined} {...aria} />
    <button type="button" onClick={open} disabled={disabled} aria-label="Chọn giờ" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100">
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button>
    <input ref={pick} type="time" tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 right-2 h-px w-px opacity-0" value={v} min={min} max={max}
      onChange={e => { const p = parseHHMM(e.target.value); if (p) { const er = check(p); if (er) { setText(p); setBad(er) } else accept(p) } }} />
    {name && <input type="hidden" name={name} value={v} />}
    {bad && <p className="mt-1 text-xs text-rose-500" role="alert">{bad}</p>}</div>;
}
