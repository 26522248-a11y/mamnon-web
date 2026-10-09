"use client";
export type Growth = { id: string; date: string; heightCm: number | null; weightKg: number | null; bmi: number | null; note: string | null };
/** Biểu đồ SVG nhẹ: cân nặng (cam) và chiều cao (xanh), mỗi đường có thang riêng. */
export function GrowthChart({ data }: { data: Growth[] }) {
  const W = 440, H = 240, P = { l: 28, r: 28, t: 20, b: 30 };
  if (data.length === 0) return <div className="flex h-40 items-center justify-center rounded-2xl bg-mint-50 text-ink-500">Chưa có số đo</div>;
  const xs = (i: number) => P.l + (data.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (data.length - 1));
  const series = (k: "weightKg" | "heightCm") => { const v = data.map(d => d[k]).filter((x): x is number => x != null); if (!v.length) return null;
    let lo = Math.min(...v), hi = Math.max(...v); const pad = Math.max((hi - lo) * 0.3, k === "weightKg" ? 1 : 3); lo -= pad; hi += pad;
    const y = (x: number) => P.t + (1 - (x - lo) / (hi - lo)) * (H - P.t - P.b);
    const pts = data.map((d, i) => d[k] == null ? null : [xs(i), y(d[k] as number), d[k]] as const).filter(Boolean) as (readonly [number, number, number])[];
    return { pts, lo, hi } };
  const w = series("weightKg"), h = series("heightCm");
  const label = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Biểu đồ tăng trưởng" data-testid="growth-chart">
    <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} rx={14} className="fill-mint-50" />
    {[0.25, 0.5, 0.75].map(f => <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)} className="stroke-mint-100" />)}
    {h && <><polyline fill="none" strokeWidth={3} strokeDasharray="6 5" className="stroke-sky-500" points={h.pts.map(p => `${p[0]},${p[1]}`).join(" ")} />
      {h.pts.map((p, i) => <g key={"h" + i}><circle cx={p[0]} cy={p[1]} r={5} className="fill-sky-500" /><text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize={11} className="fill-sky-500">{p[2]}cm</text></g>)}</>}
    {w && <><polyline fill="none" strokeWidth={4} strokeLinejoin="round" className="stroke-mint-500" points={w.pts.map(p => `${p[0]},${p[1]}`).join(" ")} />
      {w.pts.map((p, i) => <g key={"w" + i}><circle cx={p[0]} cy={p[1]} r={7} className="fill-peach-500" /><text x={p[0]} y={p[1] + 20} textAnchor="middle" fontSize={11} className="fill-peach-600">{p[2]}kg</text></g>)}</>}
    {data.map((d, i) => <text key={d.id} x={xs(i)} y={H - 10} textAnchor="middle" fontSize={12} className="fill-ink-500">{label(d.date)}</text>)}
  </svg>;
}
/** Phân loại BMI tham khảo cho trẻ 3–6 tuổi (ngưỡng gần đúng theo WHO). */
export function bmiClass(b?: number | null): [string, string] {
  if (b == null) return ["", ""]; if (b < 13.5) return ["Gầy", "text-peach-600"]; if (b <= 17) return ["Bình thường", "text-mint-700"]; if (b <= 18.5) return ["Nguy cơ thừa cân", "text-peach-600"]; return ["Thừa cân", "text-rose-500"];
}
