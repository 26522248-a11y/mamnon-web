"use client";
import { TextareaHTMLAttributes, useEffect, useRef } from "react";
/** Textarea that grows with its content (no inner scrollbar, nothing cut off). */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px" };
  useEffect(fit, [props.value]);
  return <textarea rows={2} {...props} ref={ref} onInput={e => { fit(); props.onInput?.(e) }} className={`input resize-none overflow-hidden whitespace-pre-wrap ${props.className ?? ""}`} />;
}
