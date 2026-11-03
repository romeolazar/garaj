import Link from "next/link";
import { Battery, Car, Check, FileText, Pencil, RotateCcw, Settings, ShieldCheck, TrendingUp, Upload } from "lucide-react";
import { deleteVehicle, markInstallmentPaid, markInstallmentUnpaid } from "@/app/actions";
import { toggleVehicleReminders } from "@/app/settings-actions";
import { CostBars, monthBuckets, OdometerLine, type MonthBucket } from "@/components/dashboard/charts";
import {
  AddCostModal,
  AddDocumentModal,
  AddFuelModal,
  AddPlanModal,
  AddTireModal,
  DocumentActions,
  ExpenseActions,
  InstallmentEdit,
  PlanActions,
  ServiceActions,
  TireActions
} from "@/components/dashboard/forms";
import { FuelImport } from "@/components/dashboard/fuel-import";
import { LicenseCard } from "@/components/license-card";
import { CatBadge } from "@/components/ui/icons";
import { DeleteCarDialog } from "@/components/delete-car-dialog";
import {
  ALERT_DOCUMENT_TYPES,
  categoryFor,
  costEntries,
  currentKm,
  DAY,
  docStatus,
  documentLabel,
  expenseCategoryKey,
  fmtDate,
  horsePower,
  km,
  latestDocuments,
  money,
  num,
  type GarageVehicle
} from "@/lib/garage";
import type { GarageContext } from "@/lib/garage-data";
import { fuelLabels, paymentFrequencyLabels, paymentPlanStatusLabels, tireTypeLabels } from "@/lib/labels";

export type PanelProps = { ctx: GarageContext; cars: GarageVehicle[]; selected: string; year: string; showAll: boolean };

const fuelLabel = (v: GarageVehicle) => (v.fuelType ? fuelLabels[v.fuelType] : "—");

function Head({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <div><h2>{title}</h2>{sub ? <p>{sub}</p> : null}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

function CarHead({ vehicle }: { vehicle: GarageVehicle }) {
  return (
    <div className="car-section-head">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" /> : <Car className="i" />}
      {vehicle.make} {vehicle.model} <span className="pill info">{vehicle.plateNumber}</span>
    </div>
  );
}

const scope = ({ cars, selected }: PanelProps) => (selected === "all" ? "Toate mașinile" : `${cars[0].make} ${cars[0].model} · ${cars[0].plateNumber}`);

/* ---------- Date generale ---------- */
function equipmentLines(vehicle: GarageVehicle) {
  if (vehicle.equipment) return vehicle.equipment.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // Until equipment is filled in, show what the notes list (one option per line).
  return (vehicle.notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/:$/.test(line) && !/^Expiră|^Garanție|^ANV|^Anvelope|^-|^\d{3}\/\d{2}/i.test(line))
    .slice(0, 10);
}

function Equipment({ vehicle, ctx }: { vehicle: GarageVehicle; ctx: GarageContext }) {
  const { categories, settings } = ctx;
  const factory = equipmentLines(vehicle);
  const accessories = vehicle.expenses.filter((e) => expenseCategoryKey(e, categories) === "accessories");
  const mandatory = latestDocuments(vehicle).filter((d) => d.type === "FIRST_AID_KIT" || d.type === "FIRE_EXTINGUISHER");
  return (
    <div className="grid3">
      <div className="box">
        <h3>Echipament de fabrică{!vehicle.equipment && factory.length ? <span className="count">din note</span> : null}</h3>
        {factory.length ? factory.map((line, i) => <div className="row" key={i}><span className="dot" style={{ background: "var(--accent)" }} /><div className="grow">{line}</div></div>) : <div className="hint">Completează dotările din Setări → Editează mașina.</div>}
      </div>
      <div className="box">
        <h3>Accesorii adăugate<span className="count">{money(accessories.reduce((s, e) => s + num(e.amount), 0))}</span></h3>
        {accessories.length ? accessories.map((e) => (
          <div className="row" key={e.id}>
            <CatBadge categoryKey="accessories" categories={categories} />
            <div className="grow">{e.notes && !/^https?:/i.test(e.notes) ? e.notes : "Accesoriu"}<small>{fmtDate(e.occurredAt, settings.dateFormat)}</small></div>
            <span className="amount">{money(num(e.amount))}</span>
          </div>
        )) : <div className="hint">Costurile din categoria Accesorii apar aici.</div>}
      </div>
      <div className="box">
        <h3>Echipament obligatoriu</h3>
        {mandatory.length ? mandatory.map((d) => {
          const s = docStatus(d.validUntil, settings.highPriorityDays);
          return <div className="row" key={d.id}><div className="grow">{documentLabel[d.type]}<small>până la {fmtDate(d.validUntil, settings.dateFormat)}</small></div><span className={`pill ${s.cls}`}>{s.text}</span></div>;
        }) : <div className="hint">Trusă și extinctor neînregistrate. Adaugă-le în Registru.</div>}
      </div>
    </div>
  );
}

export function GeneralPanel(props: PanelProps) {
  const { ctx, cars, selected } = props;
  const { settings } = ctx;
  if (selected === "all") {
    return (
      <>
        <Head title="Date generale" sub="Prezentare a flotei" />
        <div className="grid3">
          {cars.map((v) => {
            const bad = latestDocuments(v).filter((d) => ALERT_DOCUMENT_TYPES.includes(d.type) && docStatus(d.validUntil, settings.highPriorityDays).cls !== "ok").length;
            return (
              <Link className="box" key={v.id} href={`/?car=${v.id}&tab=general`} style={{ textDecoration: "none" }}>
                <CarHead vehicle={v} />
                <div className="spec">
                  <div><small>An</small><b>{v.manufacturingYear ?? "—"}</b></div>
                  <div><small>Combustibil</small><b>{fuelLabel(v)}</b></div>
                  <div><small>Kilometraj</small><b>{km(currentKm(v))}</b></div>
                  <div><small>Șofer</small><b>{v.driver?.firstName ?? "—"}</b></div>
                </div>
                <div style={{ marginTop: 12 }}><span className={`pill ${bad ? "bad" : "ok"}`}>{bad ? `${bad} documente necesită atenție` : "Toate documentele valabile"}</span></div>
              </Link>
            );
          })}
        </div>
      </>
    );
  }
  const v = cars[0];
  const spec: Array<[string, React.ReactNode]> = [
    ["Nr. înmatriculare", v.plateNumber],
    ["VIN", v.vin ?? "—"],
    ["Serie CIV", v.civSeries ?? "—"],
    ["Serie talon", v.registrationSeries ?? "—"],
    ["An fabricație", v.manufacturingYear ?? "—"],
    ["Combustibil", fuelLabel(v)],
    ["Putere", v.powerKw ? `${v.powerKw} kW / ${horsePower(v.powerKw)} CP` : "—"],
    ["Capacitate", v.engineCapacityCc && v.engineCapacityCc > 1 ? `${v.engineCapacityCc} cm³` : "—"],
    ["Culoare", v.color ?? "—"],
    ["Masă totală", v.totalMassKg ? `${v.totalMassKg} kg` : "—"],
    ["Locuri", v.seats ?? "—"],
    ["Kilometraj curent", km(currentKm(v))],
    ["Preț achiziție", v.acquisitionPrice ? money(num(v.acquisitionPrice)) : "—"],
    ["Garanție până la", fmtDate(v.warrantyUntil, settings.dateFormat)]
  ];
  return (
    <>
      <Head title="Date generale" sub={scope(props)}>
        <Link className="btn-secondary btn-sm" href={`/vehicles/${v.id}/edit`}><Pencil className="i" />Editează</Link>
        {ctx.isAdmin ? <DeleteCarButton vehicle={v} /> : null}
      </Head>
      <div className="box">
        <h3><Car className="i" />Identificare și specificații</h3>
        <div className="spec four">{spec.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
      </div>
      <h3 className="section-title"><ShieldCheck className="i" />Dotări</h3>
      <Equipment vehicle={v} ctx={ctx} />
      {v.notes ? <div className="box" style={{ marginTop: 16 }}><h3>Note</h3><p className="notes">{v.notes}</p></div> : null}
    </>
  );
}

/* ---------- Registru ---------- */
export function RegistryPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const { settings, categories } = ctx;
  return (
    <>
      <Head title="Registru" sub={`${scope(props)} · documente cu termen de valabilitate`}>{cars.length === 1 ? <AddDocumentModal vehicleId={cars[0].id} /> : null}</Head>
      {cars.map((v) => {
        const latest = latestDocuments(v);
        const older = v.documents.filter((d) => !latest.includes(d)).sort((a, b) => b.validUntil.getTime() - a.validUntil.getTime());
        return (
          <div className="car-section" key={v.id}>
            {cars.length > 1 ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><CarHead vehicle={v} /><AddDocumentModal vehicleId={v.id} /></div> : null}
            <div className="box">
              {latest.length ? latest.map((d) => {
                const s = docStatus(d.validUntil, settings.highPriorityDays);
                return (
                  <div className="row" key={d.id}>
                    <CatBadge categoryKey={categoryKeyForDoc(d.type)} categories={categories} />
                    <div className="grow">{documentLabel[d.type]}<small>{d.issuedAt ? `Emis ${fmtDate(d.issuedAt, settings.dateFormat)} · ` : ""}valabil până la {fmtDate(d.validUntil, settings.dateFormat)}{num(d.cost) ? ` · ${money(num(d.cost))}` : ""}</small></div>
                    <span className={`pill ${s.cls}`}>{s.text}</span>
                    <DocumentActions doc={d} />
                  </div>
                );
              }) : <div className="hint">Niciun document înregistrat.</div>}
              {older.length ? (
                <details className="history">
                  <summary>Istoric ({older.length} documente expirate)</summary>
                  {older.map((d) => (
                    <div className="row" key={d.id}>
                      <div className="grow">{documentLabel[d.type]}<small>valabil până la {fmtDate(d.validUntil, settings.dateFormat)}{num(d.cost) ? ` · ${money(num(d.cost))}` : ""}</small></div>
                      <span className="pill muted">Arhivat</span>
                      <DocumentActions doc={d} />
                    </div>
                  ))}
                </details>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

function categoryKeyForDoc(type: GarageVehicle["documents"][number]["type"]) {
  return ({ RCA: "insurance", CASCO: "insurance", CASCO_RATE: "insurance", ITP: "inspection", ROVINIETA: "tolls", CAR_LOAN: "loan", FIRST_AID_KIT: "equipment", FIRE_EXTINGUISHER: "equipment" } as Record<string, string>)[type] ?? "other";
}

/* ---------- Costuri ---------- */
export function CostsPanel(props: PanelProps) {
  const { ctx, cars, selected, year, showAll } = props;
  const { settings, categories } = ctx;
  const all = costEntries(cars, categories);
  const years = [...new Set(all.map((e) => e.date.getFullYear()))].sort((a, b) => b - a).slice(0, 4);
  const entries = year === "all" ? all : all.filter((e) => String(e.date.getFullYear()) === year);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of entries) byCat.set(e.categoryKey, (byCat.get(e.categoryKey) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const shown = showAll ? entries : entries.slice(0, 12);
  const base = `/?car=${selected}&tab=costs`;
  const findExpense = (id: string) => cars.flatMap((v) => v.expenses).find((e) => e.id === id);
  const findService = (id: string) => cars.flatMap((v) => v.services).find((s) => s.id === id);
  const findDoc = (id: string) => cars.flatMap((v) => v.documents).find((d) => d.id === id);
  const findTire = (id: string) => cars.flatMap((v) => v.tires).find((t) => t.id === id);

  return (
    <>
      <Head title="Costuri" sub={`${scope(props)} · documente, cheltuieli, revizii și anvelope într-un singur loc`}>
        <div className="seg-tabs">
          {["all", ...years.map(String)].map((y) => <Link key={y} className={year === y ? "active" : ""} href={`${base}&year=${y}`} scroll={false} style={{ padding: "6px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none", color: year === y ? "var(--text)" : "var(--muted)", background: year === y ? "var(--surface)" : "transparent" }}>{y === "all" ? "Tot" : y}</Link>)}
        </div>
        <AddCostModal vehicles={cars} selected={selected} categories={categories} triggerClassName="btn btn-sm" />
      </Head>
      <div className="grid2">
        <div className="box">
          <h3>Pe categorii<span className="count">{entries.length} înregistrări</span></h3>
          <div className="big">{money(total)}</div>
          <div className="stack">{cats.map(([key, value]) => <span key={key} title={categoryFor(key, categories).name} style={{ width: `${(value / (total || 1)) * 100}%`, background: categoryFor(key, categories).color }} />)}</div>
          {cats.map(([key, value]) => (
            <div className="row" key={key}>
              <CatBadge categoryKey={key} categories={categories} />
              <div className="grow">{categoryFor(key, categories).name}</div>
              <small style={{ color: "var(--muted)" }}>{Math.round((value / (total || 1)) * 100)}%</small>
              <span className="amount">{money(value)}</span>
            </div>
          ))}
        </div>
        <div className="box">
          <h3>Înregistrări{entries.length > 12 ? <Link className="count" href={`${base}&year=${year}${showAll ? "" : "&all=1"}`} scroll={false}>{showAll ? "Arată mai puține" : `Toate ${entries.length}`}</Link> : null}</h3>
          {shown.map((e) => {
            const expense = e.kind === "expense" ? findExpense(e.id) : undefined;
            const service = e.kind === "service" ? findService(e.id) : undefined;
            const doc = e.kind === "document" ? findDoc(e.id) : undefined;
            const tire = e.kind === "tire" ? findTire(e.id) : undefined;
            return (
              <div className="row" key={`${e.kind}-${e.id}`}>
                <CatBadge categoryKey={e.categoryKey} categories={categories} />
                <div className="grow">{e.title}<small>{fmtDate(e.date, settings.dateFormat)}{e.km ? ` · ${km(e.km)}` : ""}{selected === "all" ? ` · ${e.vehicle.plateNumber}` : ""}</small></div>
                <span className="amount">{money(e.amount)}</span>
                {expense ? <ExpenseActions expense={expense} categories={categories} /> : null}
                {service ? <ServiceActions service={service} /> : null}
                {doc ? <DocumentActions doc={doc} /> : null}
                {tire ? <TireActions tire={tire} /> : null}
              </div>
            );
          })}
          {!shown.length ? <div className="hint">Niciun cost în perioada aleasă.</div> : null}
        </div>
      </div>
      <PaymentPlans {...props} />
    </>
  );
}

function PaymentPlans({ ctx, cars }: PanelProps) {
  const { settings } = ctx;
  const plans = cars.flatMap((v) => v.paymentPlans.map((plan) => ({ plan, vehicle: v })));
  return (
    <>
      <div className="section-title" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><TrendingUp className="i" />Rate recurente</span>
        {cars.length === 1 ? <AddPlanModal vehicleId={cars[0].id} /> : null}
      </div>
      {plans.length ? (
        <div className="grid2">
          {plans.map(({ plan, vehicle }) => {
            const paid = plan.installments.filter((i) => i.status === "PAID");
            const next = plan.installments.find((i) => i.status === "UNPAID");
            return (
              <div className="box" key={plan.id}>
                <h3>{plan.name}<span className="count">{paymentPlanStatusLabels[plan.status]}</span><PlanActions plan={plan} /></h3>
                <small style={{ color: "var(--muted)" }}>{cars.length > 1 ? `${vehicle.plateNumber} · ` : ""}{paymentFrequencyLabels[plan.frequency]} · {plan.totalInstallments} rate × {money(num(plan.installmentAmount))} · total {money(num(plan.totalAmount))}</small>
                <div className="progress" style={{ margin: "12px 0 6px" }}><span style={{ width: `${(paid.length / (plan.installments.length || 1)) * 100}%` }} /></div>
                <small style={{ color: "var(--muted)" }}>{paid.length} din {plan.installments.length} plătite{next ? ` · următoarea: ${fmtDate(next.dueDate, settings.dateFormat)}` : ""}</small>
                <details className="history">
                  <summary>Ratele</summary>
                  {plan.installments.map((i) => (
                    <div className="row" key={i.id}>
                      <div className="grow">Rata {i.installmentNumber}<small>{fmtDate(i.dueDate, settings.dateFormat)} · {money(num(i.amount))}{i.paidDate ? ` · plătită ${fmtDate(i.paidDate, settings.dateFormat)}` : ""}</small></div>
                      <span className={`pill ${i.status === "PAID" ? "ok" : i.status === "CANCELLED" ? "muted" : i.dueDate < new Date() ? "bad" : "warn"}`}>{i.status === "PAID" ? "Plătită" : i.status === "CANCELLED" ? "Anulată" : "Neplătită"}</span>
                      <form action={(i.status === "PAID" ? markInstallmentUnpaid : markInstallmentPaid).bind(null, i.id)}>
                        <button className="icon-sm" title={i.status === "PAID" ? "Marchează neplătită" : "Marchează plătită"}>{i.status === "PAID" ? <RotateCcw className="i" style={{ width: 14, height: 14 }} /> : <Check className="i" style={{ width: 14, height: 14 }} />}</button>
                      </form>
                      <InstallmentEdit installment={i} />
                    </div>
                  ))}
                </details>
              </div>
            );
          })}
        </div>
      ) : <div className="box"><div className="hint">Niciun plan de rate. {cars.length > 1 ? "Selectează o mașină ca să adaugi unul." : "Credit, leasing sau asigurări plătite în rate."}</div></div>}
    </>
  );
}

/* ---------- Statistici ---------- */
export function StatsPanel(props: PanelProps) {
  const { ctx, cars, selected } = props;
  const { categories, settings } = ctx;
  const entries = costEntries(cars, categories);
  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth(), cats: {} });
  }
  monthBuckets(entries, months);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const purchase = cars.reduce((s, v) => s + num(v.acquisitionPrice), 0);
  const totalKm = cars.reduce((s, v) => s + (currentKm(v) ?? 0), 0);
  const first = entries.length ? Math.min(...entries.map((e) => e.date.getTime())) : now.getTime();
  const monthsSpan = Math.max(1, (now.getTime() - first) / (30.4 * DAY));
  const v = selected === "all" ? null : cars[0];
  const points: Array<[Date, number]> = v
    ? [...v.services.map((s) => [s.servicedAt, s.odometerKm] as const), ...v.expenses.map((e) => [e.occurredAt, e.odometerKm] as const)]
        .filter((p): p is readonly [Date, number] => !!p[1])
        .map(([d, k]) => [d, k] as [Date, number])
        .sort((a, b) => a[0].getTime() - b[0].getTime())
    : [];
  return (
    <>
      <Head title="Statistici" sub={scope(props)} />
      <div className="kpis">
        <div className="box kpi"><small>Cost total deținere</small><b>{money(purchase + total)}</b></div>
        <div className="box kpi"><small>Cheltuieli (fără achiziție)</small><b>{money(total)}</b></div>
        <div className="box kpi"><small>Medie lunară</small><b>{money(total / monthsSpan)}</b></div>
        <div className="box kpi"><small>Cost / km</small><b>{totalKm ? `${(total / totalKm).toFixed(2)} RON` : "—"}</b></div>
      </div>
      <div className="box"><h3>Costuri pe ultimele 12 luni</h3><CostBars months={months} categories={categories} /></div>
      {points.length > 1 ? <div className="box" style={{ marginTop: 16 }}><h3>Evoluție kilometraj</h3><OdometerLine points={points} dateFormat={settings.dateFormat} /></div> : null}
    </>
  );
}

/* ---------- Combustibil ---------- */
export function FuelPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const { settings, categories } = ctx;
  return (
    <>
      <Head title="Combustibil" sub={`${scope(props)} · alimentări și încărcări`} />
      {cars.map((v) => {
        const electric = v.fuelType === "ELECTRIC";
        const unit = electric ? "kWh" : "L";
        const key = electric ? "charging" : "fuel";
        const rows = v.expenses.filter((e) => e.category === (electric ? "CHARGING" : "FUEL")).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
        const spent = rows.reduce((s, e) => s + num(e.amount), 0);
        const energy = rows.reduce((s, e) => s + (e.quantity ?? 0), 0);
        const withKm = rows.filter((e) => e.quantity && e.odometerKm).sort((a, b) => a.odometerKm! - b.odometerKm!);
        const span = withKm.length > 1 ? withKm[withKm.length - 1].odometerKm! - withKm[0].odometerKm! : 0;
        const qtyInSpan = span ? rows.filter((e) => e.quantity && e.occurredAt > withKm[0].occurredAt && e.occurredAt <= withKm[withKm.length - 1].occurredAt).reduce((s, e) => s + (e.quantity ?? 0), 0) : 0;
        const consumption = span ? (qtyInSpan / span) * 100 : null;
        const shown = props.showAll ? rows : rows.slice(0, 12);
        return (
          <div className="car-section" key={v.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {cars.length > 1 ? <CarHead vehicle={v} /> : <span />}
              <div className="actions" style={{ display: "flex", gap: 8 }}>
                <FuelImport vehicleId={v.id} electric={electric} trigger={<><Upload className="i" />Importă CSV / Excel</>} />
                <AddFuelModal vehicles={[v]} selected={v.id} />
              </div>
            </div>
            <div className="kpis">
              <div className="box kpi"><small>{electric ? "Încărcări" : "Alimentări"}</small><b>{rows.length}</b></div>
              <div className="box kpi"><small>{electric ? "Energie" : "Combustibil"} total</small><b>{energy ? `${Math.round(energy).toLocaleString("ro-RO")} ${unit}` : "—"}</b></div>
              <div className="box kpi"><small>Total cheltuit</small><b>{money(spent)}</b></div>
              <div className="box kpi"><small>Consum mediu</small><b>{consumption ? consumption.toFixed(1) : "—"} {unit}/100 km</b></div>
            </div>
            <div className="box">
              {shown.length ? shown.map((e) => (
                <div className="row" key={e.id}>
                  <CatBadge categoryKey={key} categories={categories} />
                  <div className="grow">
                    {fmtDate(e.occurredAt, settings.dateFormat)}{e.importKey ? <> <span className="pill muted">importat</span></> : null}
                    <small>{[
                      e.quantity ? `${e.quantity.toLocaleString("ro-RO")} ${unit}${e.unitPrice ? ` × ${num(e.unitPrice)} RON` : ""}` : `cantitate: — ${unit}`,
                      e.socStart !== null && e.socEnd !== null ? `baterie ${e.socStart}% → ${e.socEnd}%` : null,
                      e.durationMin ? `${e.durationMin} min` : null,
                      e.odometerKm ? km(e.odometerKm) : null,
                      e.station ?? e.notes
                    ].filter(Boolean).join(" · ")}</small>
                  </div>
                  <span className="amount">{num(e.amount) ? money(num(e.amount)) : "—"}</span>
                  <ExpenseActions expense={e} categories={categories} returnTab="fuel" />
                </div>
              )) : <div className="hint">Nicio {electric ? "încărcare" : "alimentare"} înregistrată.</div>}
              {rows.length > shown.length ? <p className="ios-caption"><Link href={`/?car=${props.selected}&tab=fuel&all=1`} scroll={false}>Arată toate cele {rows.length}</Link></p> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Anvelope ---------- */
const TIRE_COLOR = { SUMMER: "#f59e0b", WINTER: "#3b82f6", ALL_SEASON: "#10b981" } as const;

export function TiresPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const { settings } = ctx;
  return (
    <>
      <Head title="Anvelope" sub={scope(props)}>{cars.length === 1 ? <AddTireModal vehicleId={cars[0].id} /> : null}</Head>
      {cars.map((v) => {
        const sizes = (v.notes ?? "").match(/\d{3}\/\d{2}\s?R\d{2}[^\n\r]*/g);
        const tires = [...v.tires].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
        return (
          <div className="car-section" key={v.id}>
            {cars.length > 1 ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><CarHead vehicle={v} /><AddTireModal vehicleId={v.id} /></div> : null}
            <div className="grid2">
              {tires.map((t, i) => (
                <div className="box" key={t.id}>
                  <div className="tire">
                    <div className="tire-icon" />
                    <div className="grow" style={{ flex: 1 }}>
                      <span className="pill" style={{ background: `${TIRE_COLOR[t.type]}22`, color: TIRE_COLOR[t.type] }}>{tireTypeLabels[t.type]}</span> {i === 0 ? <span className="pill info">Cel mai recent</span> : null}
                      <div style={{ marginTop: 6 }}><b>{t.brand} {t.model ?? ""}</b></div>
                      <small>{t.size} · cumpărate {fmtDate(t.purchasedAt, settings.dateFormat)} · {((Date.now() - t.purchasedAt.getTime()) / (365.25 * DAY)).toFixed(1)} ani{num(t.cost) ? ` · ${money(num(t.cost))}` : ""}</small>
                      {t.notes ? <small>{t.notes}</small> : null}
                    </div>
                    <TireActions tire={t} />
                  </div>
                </div>
              ))}
              {sizes ? <div className="box"><h3>Dimensiuni omologate</h3>{sizes.map((size, i) => <div className="row" key={i}><div className="grow">{size.trim()}</div></div>)}</div> : null}
              {!tires.length && !sizes ? <div className="box"><div className="hint">Niciun set de anvelope înregistrat.</div></div> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Baterie ---------- */
export function BatteryPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const { settings } = ctx;
  return (
    <>
      <Head title="Baterie" sub={scope(props)} />
      {cars.map((v) => {
        const electric = v.fuelType === "ELECTRIC";
        const twelve = [...v.services].filter((s) => /BATERIE/i.test(s.notes ?? "")).sort((a, b) => b.servicedAt.getTime() - a.servicedAt.getTime())[0];
        const current = currentKm(v);
        const warrantyKm = v.batteryWarrantyKm;
        const charges = v.expenses.filter((e) => e.category === "CHARGING" && e.quantity);
        const fullCharges = charges.filter((e) => e.socStart !== null && e.socEnd !== null && e.socEnd - e.socStart >= 30 && e.quantity);
        const estimatedCapacity = fullCharges.length ? fullCharges.reduce((s, e) => s + (e.quantity! / ((e.socEnd! - e.socStart!) / 100)), 0) / fullCharges.length : null;
        return (
          <div className="car-section" key={v.id}>
            {cars.length > 1 ? <CarHead vehicle={v} /> : null}
            <div className="grid2">
              <div className="box">
                <h3><Battery className="i" />Baterie de tracțiune</h3>
                {electric ? (
                  <>
                    <div className="spec">
                      <div><small>Capacitate</small><b>{v.batteryCapacityKwh ? `${v.batteryCapacityKwh} kWh` : "—"}</b></div>
                      <div><small>Estimată din încărcări</small><b>{estimatedCapacity ? `~${estimatedCapacity.toFixed(0)} kWh` : "—"}</b></div>
                      <div><small>Garanție până la</small><b>{fmtDate(v.batteryWarrantyUntil ?? v.warrantyUntil, settings.dateFormat)}</b></div>
                      <div><small>Garanție km</small><b>{warrantyKm ? km(warrantyKm) : "—"}</b></div>
                    </div>
                    {warrantyKm && current ? (
                      <div style={{ marginTop: 14 }}>
                        <small style={{ color: "var(--muted)" }}>Km consumați din garanție: {Math.round((current / warrantyKm) * 100)}%</small>
                        <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (current / warrantyKm) * 100)}%` }} /></div>
                      </div>
                    ) : null}
                    {!v.batteryCapacityKwh ? <p className="ios-caption">Capacitatea și garanția bateriei se completează din Setări → Editează mașina.</p> : null}
                  </>
                ) : <div className="hint">Nu se aplică ({fuelLabel(v)}).</div>}
              </div>
              <div className="box">
                <h3><Battery className="i" />Baterie 12V</h3>
                {twelve ? (
                  <div className="spec">
                    <div><small>Ultima înlocuire</small><b>{fmtDate(twelve.servicedAt, settings.dateFormat)}</b></div>
                    <div><small>La kilometrajul</small><b>{km(twelve.odometerKm)}</b></div>
                    <div><small>Vechime</small><b>{((Date.now() - twelve.servicedAt.getTime()) / (365.25 * DAY)).toFixed(1)} ani</b></div>
                    <div><small>Detaliu</small><b>{((twelve.notes ?? "").split(/\r?\n/).find((l) => /BATERIE/i.test(l)) ?? "").replace("*", "")}</b></div>
                  </div>
                ) : <div className="hint">Nicio înlocuire găsită în revizii.</div>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Șoferi ---------- */
export function DriversPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const drivers = cars.filter((v) => v.driver).filter((v, i, list) => list.findIndex((x) => x.driver!.id === v.driver!.id) === i);
  return (
    <>
      <Head title="Șoferi" sub={scope(props)}>{ctx.isAdmin ? <Link className="btn-secondary btn-sm" href="/users">Toți șoferii</Link> : null}</Head>
      {drivers.length ? <div className="grid3">{drivers.map((v) => <LicenseCard key={v.driver!.id} driver={v.driver!} vehicle={v} highPriorityDays={ctx.settings.highPriorityDays} />)}</div> : <div className="box"><div className="hint">Niciun șofer alocat.</div></div>}
    </>
  );
}

/* ---------- Setări mașină ---------- */
export function CarSettingsPanel(props: PanelProps) {
  const { ctx, cars } = props;
  const host = (url: string | null) => { try { return url ? new URL(url).hostname : "—"; } catch { return "—"; } };
  return (
    <>
      <Head title="Setări mașină" sub={props.selected === "all" ? "Setările fiecărei mașini" : scope(props)}>
        {ctx.isAdmin ? <Link className="btn-secondary btn-sm" href="/settings"><Settings className="i" />Setări aplicație</Link> : null}
      </Head>
      <div className={cars.length > 1 ? "grid3" : "settings-pane"}>
        {cars.map((v) => (
          <div key={v.id}>
            {cars.length > 1 ? <CarHead vehicle={v} /> : null}
            <div className="ios-group">
              <div className="ios-row">
                <div className="grow">Mementouri pentru această mașină<small>{v.remindersEnabled ? "Notificări Telegram active" : "Oprite"}</small></div>
                <form action={toggleVehicleReminders.bind(null, v.id)}><button className={`toggle ${v.remindersEnabled ? "on" : ""}`} title="Comută mementourile" /></form>
              </div>
              <Link className="ios-row" href={`/vehicles/${v.id}/edit`}><div className="grow">Editează datele mașinii<small>Șofer: {v.driver ? `${v.driver.firstName} ${v.driver.lastName}` : "niciunul"} · logo: {host(v.imageUrl)} · fundal: {host(v.backgroundImageUrl)}</small></div><Pencil className="i chev-r" /></Link>
              <Link className="ios-row" href={`/?car=${v.id}&tab=registry`}><div className="grow">Documente</div><FileText className="i chev-r" /></Link>
              {ctx.isAdmin ? (
                <div className="ios-row">
                  <div className="grow">Șterge mașina<small>Se șterg și documentele, costurile, fișierele și istoricul</small></div>
                  <DeleteCarButton vehicle={v} iconOnly />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DeleteCarButton({ vehicle, iconOnly = false }: { vehicle: GarageVehicle; iconOnly?: boolean }) {
  return (
    <DeleteCarDialog
      action={deleteVehicle.bind(null, vehicle.id)}
      car={vehicle}
      iconOnly={iconOnly}
      counts={{ documents: vehicle.documents.length, costs: vehicle.expenses.length, services: vehicle.services.length, tires: vehicle.tires.length, plans: vehicle.paymentPlans.length, files: vehicle._count.files }}
    />
  );
}

export const PANELS = {
  general: GeneralPanel,
  registry: RegistryPanel,
  costs: CostsPanel,
  stats: StatsPanel,
  fuel: FuelPanel,
  tires: TiresPanel,
  battery: BatteryPanel,
  drivers: DriversPanel,
  settings: CarSettingsPanel
};
