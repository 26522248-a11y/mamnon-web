/** Display helpers: always dd/mm/yyyy (VN). Values passed around stay ISO (YYYY-MM-DD / ISO-8601). */
const TZ = "Asia/Ho_Chi_Minh";
const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10-09" or ISO timestamp / Date → "09/10/2026" ("" for empty/invalid). Plain dates are not shifted by time zone. */
export function fmtDate(v?: string | Date | null): string {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split("-"); return `${d}/${m}/${y}` }
  const x = typeof v === "string" ? new Date(v) : v; if (isNaN(x.getTime())) return String(v);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(x).map(o => [o.type, o.value]));
  return `${p.day}/${p.month}/${p.year}`;
}
/** ISO timestamp → "HH:MM dd/mm/yyyy" (VN time). */
export function fmtDateTime(v?: string | Date | null): string {
  if (!v) return ""; const x = typeof v === "string" ? new Date(v) : v; if (isNaN(x.getTime())) return String(v);
  return `${x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ })} ${fmtDate(x)}`;
}
/** "dd/mm/yyyy" (or ISO typed in) → "YYYY-MM-DD", or null if not a real date. */
export function parseVnDate(s: string): string | null {
  const t = s.trim(); let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t); const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] } else if (vn) { d = +vn[1]; m = +vn[2]; y = +vn[3] } else return null;
  const x = new Date(Date.UTC(y, m - 1, d)); if (x.getUTCFullYear() !== y || x.getUTCMonth() !== m - 1 || x.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
