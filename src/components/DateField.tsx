"use client";
/**
 * Date input that always shows dd/mm/yyyy regardless of browser locale; value stays ISO "YYYY-MM-DD".
 * Typing: digits auto-insert "/" (ISO paste also accepted). Calendar icon button opens the native picker (hidden <input type="date">).
 * Works controlled (value + onChange(iso)) or inside a <form> (name + defaultValue → hidden input carries the ISO value).
 */
import { useEffect, useRef, useState } from "react";
import { fmtDate, parseVnDate } from "@/lib/date";

type Props = { value?: string; defaultValue?: string; onChange?: (iso: string) => void; name?: string; min?: string; max?: string; required?: boolean;
  className?: string; placeholder?: string; disabled?: boolean; "data-testid"?: string; "aria-label"?: string; id?: string };

const mask = (raw: string) => { if (/^\d{4}-/.test(raw)) return raw.slice(0, 10); // ISO paste
  const d = raw.replace(/\D/g, "").slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/") };

export function DateField({ value, defaultValue, onChange, name, min, max, required, className = "", placeholder = "dd/mm/yyyy", disabled, id, ...aria }: Props) {
  const controlled = value !== undefined;
  const [iso, setIso] = useState(controlled ? value! : defaultValue ?? ""); const [text, setText] = useState(fmtDate(iso)); const [bad, setBad] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => { if (controlled && value !== iso) { setIso(value!); setText(fmtDate(value!)); setBad("") } }, [controlled, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (v: string) => { setIso(v); setText(fmtDate(v)); setBad(""); onChange?.(v) };
  const check = (v: string | null): string => !v ? "Ngày không hợp lệ (dd/mm/yyyy)" : min && v < min ? `Không trước ${fmtDate(min)}` : max && v > max ? `Không sau ${fmtDate(max)}` : "";
  const typed = (raw: string) => { const t = mask(raw); setText(t);
    if (!t) { setBad(""); if (iso) { setIso(""); onChange?.("") } return }
    const v = parseVnDate(t); if (t.length >= 10) { const e = check(v); setBad(e); if (!e && v) { setIso(v); onChange?.(v) } } };
  const open = () => { const el = pick.current; if (!el || disabled) return; try { el.showPicker() } catch { el.focus(); el.click() } };
  return <div className={`relative ${className}`}>
    <input type="text" inputMode="numeric" autoComplete="off" className={`input pr-12 ${bad ? "!border-rose-500" : ""}`} placeholder={placeholder} value={text} id={id}
      onChange={e => typed(e.target.value)} onBlur={() => { if (text && !parseVnDate(text)) setBad("Ngày không hợp lệ (dd/mm/yyyy)") }}
      required={required} disabled={disabled} maxLength={10} aria-invalid={!!bad || undefined} {...aria} />
    <button type="button" onClick={open} disabled={disabled} aria-label="Chọn ngày" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100">
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg></button>
    <input ref={pick} type="date" tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 right-2 h-px w-px opacity-0" value={iso} min={min} max={max}
      onChange={e => { if (e.target.value) commit(e.target.value) }} />
    {name && <input type="hidden" name={name} value={iso} />}
    {bad && <p className="mt-1 text-xs text-rose-500" role="alert">{bad}</p>}</div>;
}
