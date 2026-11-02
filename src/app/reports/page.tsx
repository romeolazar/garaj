import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CostBars, monthBuckets, type MonthBucket } from "@/components/dashboard/charts";
import { CatBadge } from "@/components/ui/icons";
import { costEntries, money } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { vehicles, categories } = await loadGarage();
  const entries = costEntries(vehicles, categories);
  const years = [...new Set(entries.map((e) => e.date.getFullYear()))].sort((a, b) => b - a);
  const requested = Number((await searchParams).year);
  const year = years.includes(requested) ? requested : years[0] ?? new Date().getFullYear();
  const yearEntries = entries.filter((e) => e.date.getFullYear() === year);
  const total = yearEntries.reduce((s, e) => s + e.amount, 0);
  const months: MonthBucket[] = Array.from({ length: 12 }, (_, m) => ({ y: year, m, cats: {} }));
  monthBuckets(yearEntries, months);
  const sum = (filter: (e: (typeof yearEntries)[number]) => boolean) => yearEntries.filter(filter).reduce((s, e) => s + e.amount, 0);
  const usedCategories = categories.filter((c) => yearEntries.some((e) => e.categoryKey === c.key));

  return (
    <AppShell active="reports">
      <section className="card page">
        <div className="panel-head">
          <div><h2>Rapoarte</h2><p>Toate costurile pe {year}, pe mașini și categorii</p></div>
          <div className="actions">
            <div className="seg-tabs">{years.slice(0, 5).map((y) => <Link key={y} href={`/reports?year=${y}`} className={y === year ? "active" : ""}>{y}</Link>)}</div>
            <a className="btn-secondary btn-sm" href={`/api/export/csv?year=${year}`}><Download className="i" />Export CSV</a>
          </div>
        </div>
        <div className="kpis">
          <div className="box kpi"><small>Total {year}</small><b>{money(total)}</b></div>
          {vehicles.map((v) => <div className="box kpi" key={v.id}><small>{v.make} {v.model}</small><b>{money(sum((e) => e.vehicle.id === v.id))}</b></div>)}
        </div>
        <div className="box"><h3><BarChart3 className="i" />Costuri lunare {year}</h3><CostBars months={months} categories={categories} /></div>
        <h3 className="section-title">Pe mașini și categorii</h3>
        <div className="box table-wrap">
          <table className="data">
            <thead><tr><th>Categorie</th>{vehicles.map((v) => <th key={v.id}>{v.plateNumber}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {usedCategories.map((c) => (
                <tr key={c.key}>
                  <td><span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 10 }}><CatBadge categoryKey={c.key} categories={categories} /></span>{c.name}</td>
                  {vehicles.map((v) => { const value = sum((e) => e.vehicle.id === v.id && e.categoryKey === c.key); return <td key={v.id}>{value ? money(value) : "—"}</td>; })}
                  <td><b>{money(sum((e) => e.categoryKey === c.key))}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td>{vehicles.map((v) => <td key={v.id}>{money(sum((e) => e.vehicle.id === v.id))}</td>)}<td>{money(total)}</td></tr></tfoot>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
