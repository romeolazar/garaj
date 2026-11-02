import type { CostCategory } from "@/lib/cost-categories";
import { categoryFor, fmtDate, km, money, MONTHS, type CostEntry } from "@/lib/garage";

const W = 1000;
const H = 230;
const P = 40;

export type MonthBucket = { y: number; m: number; cats: Record<string, number> };

export function monthBuckets(entries: CostEntry[], months: MonthBucket[]) {
  for (const entry of entries) {
    const slot = months.find((x) => x.y === entry.date.getFullYear() && x.m === entry.date.getMonth());
    if (slot) slot.cats[entry.categoryKey] = (slot.cats[entry.categoryKey] ?? 0) + entry.amount;
  }
  return months;
}

export function CostBars({ months, categories }: { months: MonthBucket[]; categories: CostCategory[] }) {
  const max = Math.max(1, ...months.map((x) => Object.values(x.cats).reduce((s, v) => s + v, 0)));
  const bw = (W - P - 10) / months.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P} x2={W} y1={H - 24 - f * (H - 50)} y2={H - 24 - f * (H - 50)} stroke="var(--border)" />
          <text x={P - 6} y={H - 20 - f * (H - 50)} textAnchor="end">{Math.round((max * f) / 1000)}k</text>
        </g>
      ))}
      {months.map((x, i) => {
        let y = H - 24;
        return (
          <g key={`${x.y}-${x.m}`}>
            {Object.entries(x.cats).map(([key, value]) => {
              const h = (value / max) * (H - 50);
              y -= h;
              const category = categoryFor(key, categories);
              return <rect key={key} x={P + i * bw + 8} y={y} width={Math.max(2, bw - 16)} height={h} rx="3" fill={category.color}><title>{`${category.name}: ${money(value)}`}</title></rect>;
            })}
            <text x={P + i * bw + bw / 2} y={H - 6} textAnchor="middle">{MONTHS[x.m]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function OdometerLine({ points, dateFormat }: { points: Array<[Date, number]>; dateFormat: string }) {
  if (points.length < 2) return null;
  const t0 = points[0][0].getTime();
  const t1 = points[points.length - 1][0].getTime();
  const k1 = Math.max(...points.map((p) => p[1]));
  const xy = points.map(([t, k]) => [P + ((t.getTime() - t0) / (t1 - t0 || 1)) * (W - P - 10), H - 24 - (k / k1) * (H - 50)]);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      <line x1={P} x2={W} y1={H - 24} y2={H - 24} stroke="var(--border)" />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={xy.map((p) => p.join(",")).join(" ")} />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--accent)"><title>{`${fmtDate(points[i][0], dateFormat)}: ${km(points[i][1])}`}</title></circle>)}
      <text x={P} y={H - 6}>{new Date(t0).getFullYear()}</text>
      <text x={W - 10} y={H - 6} textAnchor="end">{new Date(t1).getFullYear()}</text>
      <text x={P - 6} y={H - 20 - (H - 50)} textAnchor="end">{Math.round(k1 / 1000)}k</text>
    </svg>
  );
}
