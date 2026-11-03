import Link from "next/link";
import { redirect } from "next/navigation";
import { Battery, ChartLine, ChevronDown, FolderOpen, Fuel, Info, LayoutGrid, LifeBuoy, Plus, SlidersHorizontal, UsersRound, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddCostModal } from "@/components/dashboard/forms";
import { PANELS } from "@/components/dashboard/panels";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar } from "@/components/ui/avatar";
import { CatBadge } from "@/components/ui/icons";
import { Plate } from "@/components/ui/plate";
import { costEntries, currentKm, docStatus, documentLabel, fmtDate, horsePower, km, latestDocuments, money, type GarageVehicle } from "@/lib/garage";
import { loadGarage, type GarageContext } from "@/lib/garage-data";
import { fuelLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TABS = [
  ["general", "Date generale", Info],
  ["registry", "Registru", FolderOpen],
  ["costs", "Costuri", Wallet],
  ["stats", "Statistici", ChartLine],
  ["fuel", "Combustibil", Fuel],
  ["tires", "Anvelope", LifeBuoy],
  ["battery", "Baterie", Battery],
  ["drivers", "Șoferi", UsersRound],
  ["settings", "Setări", SlidersHorizontal]
] as const;

type TabKey = (typeof TABS)[number][0];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ car?: string; tab?: string; year?: string; all?: string; error?: string; deleted?: string }> }) {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins === 0) redirect("/setup");

  const ctx = await loadGarage();
  const params = await searchParams;
  const selected = params.car && ctx.vehicles.some((v) => v.id === params.car) ? params.car : "all";
  const tab = TABS.some(([key]) => key === params.tab) ? (params.tab as TabKey) : null;
  const cars = selected === "all" ? ctx.vehicles : ctx.vehicles.filter((v) => v.id === selected);
  const href = (car: string, nextTab: string | null) => `/?car=${car}${nextTab ? `&tab=${nextTab}` : ""}`;

  if (!ctx.vehicles.length) {
    return (
      <AppShell active="dashboard">
        {params.deleted ? <div className="notice ok">Mașina a fost ștearsă.</div> : null}
        <section className="card empty-garage">
          <span className="brand-mark" style={{ width: 64, height: 64 }}><AppLogo id="empty" /></span>
          <h2 style={{ margin: 0 }}>Garajul e gol</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>{ctx.isAdmin ? "Adaugă prima mașină sau importă un backup din Setări." : "Administratorul nu ți-a alocat încă o mașină."}</p>
          {ctx.isAdmin ? <div style={{ display: "flex", gap: 8 }}><Link className="btn" href="/vehicles/new"><Plus className="i" />Adaugă mașină</Link><Link className="btn-secondary" href="/settings?section=backup">Importă backup</Link></div> : null}
        </section>
      </AppShell>
    );
  }

  const Panel = tab ? PANELS[tab] : null;

  return (
    <AppShell active="dashboard">
      {params.deleted ? <div className="notice ok">Mașina a fost ștearsă.</div> : null}
      {params.error ? <div className="notice bad">Formularul nu a fost salvat: verifică câmpurile obligatorii.</div> : null}
      <section className="top-grid">
        <div className="hero">{selected === "all" ? <Segments vehicles={ctx.vehicles} tab={tab} /> : <SingleHero vehicle={cars[0]} ctx={ctx} />}</div>
        <aside className="side"><Activity ctx={ctx} cars={cars} all={selected === "all"} /></aside>
      </section>

      <section className="card carbar">
        <Link className={`car-pill ${selected === "all" ? "active" : ""}`} href={href("all", tab)} scroll={false}>
          <span className="all"><LayoutGrid className="i" /></span>
          <span>Toate mașinile<small>{ctx.vehicles.length} {ctx.vehicles.length === 1 ? "vehicul" : "vehicule"}</small></span>
        </Link>
        {ctx.vehicles.map((v) => (
          <Link key={v.id} className={`car-pill ${selected === v.id ? "active" : ""}`} href={href(v.id, tab)} scroll={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.imageUrl ? <img src={v.imageUrl} alt="" /> : <span className="all">{v.make[0]}</span>}
            <span>{v.make} {v.model}<small>{v.plateNumber}</small></span>
          </Link>
        ))}
        {ctx.isAdmin ? <Link className="car-pill" href="/vehicles/new" title="Adaugă mașină"><span className="all"><Plus className="i" /></span><span>Mașină nouă</span></Link> : null}
        <span className="spacer" />
        <AddCostModal vehicles={ctx.vehicles} selected={selected} categories={ctx.categories} returnTab={tab ?? "costs"} />
      </section>

      <nav className="card tabs">
        {TABS.map(([key, label, Icon]) => (
          <Link key={key} className={`tab ${tab === key ? "active" : ""}`} href={href(selected, tab === key ? null : key)} scroll={false}>
            <Icon className="i" />{label}<ChevronDown className="i chev" />
          </Link>
        ))}
      </nav>

      {Panel ? (
        <div className="panel-wrap open">
          <div>
            <section className="card tab-panel">
              <Panel ctx={ctx} cars={cars} selected={selected} year={params.year && /^(all|\d{4})$/.test(params.year) ? params.year : "all"} showAll={params.all === "1"} />
            </section>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Segments({ vehicles, tab }: { vehicles: GarageVehicle[]; tab: string | null }) {
  return (
    <div className="segments">
      {vehicles.map((v) => (
        <Link key={v.id} className="seg" href={`/?car=${v.id}${tab ? `&tab=${tab}` : ""}`} scroll={false} title={`${v.make} ${v.model}`}>
          <div className="seg-bg" style={v.backgroundImageUrl ? { backgroundImage: `url("${v.backgroundImageUrl}")` } : undefined} />
          {v.driver ? <div className="seg-driver"><Avatar name={v.driver} imageUrl={v.driver.profileImageUrl} /><span>{v.driver.firstName}</span></div> : null}
          <div className="seg-info"><Plate plateNumber={v.plateNumber} electric={v.fuelType === "ELECTRIC"} big /></div>
        </Link>
      ))}
    </div>
  );
}

function SingleHero({ vehicle: v, ctx }: { vehicle: GarageVehicle; ctx: GarageContext }) {
  const next = latestDocuments(v).find((d) => d.validUntil.getTime() > Date.now() - 365 * 86_400_000);
  const status = next ? docStatus(next.validUntil, ctx.settings.highPriorityDays) : null;
  return (
    <>
      <div className="hero-bg" style={v.backgroundImageUrl ? { backgroundImage: `url("${v.backgroundImageUrl}")` } : undefined} />
      <div className="hero-shade" />
      {v.driver ? (
        <div className="hero-badge driver">
          <Avatar name={v.driver} imageUrl={v.driver.profileImageUrl} />
          <div><b>{v.driver.firstName} {v.driver.lastName}</b><small>{v.driver.role === "ADMIN" ? "Administrator" : "Șofer"}{v.driver.licenseCategory ? ` · ${v.driver.licenseCategory}` : ""}</small></div>
        </div>
      ) : null}
      <div className="hero-content">
        <div>
          <div className="car-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.imageUrl ? <div className="logo-chip"><img src={v.imageUrl} alt="" /></div> : null}
            <div><h1>{v.make} {v.model}</h1><Plate plateNumber={v.plateNumber} electric={v.fuelType === "ELECTRIC"} /></div>
          </div>
          <div className="chips">
            {v.manufacturingYear ? <span className="chip">{v.manufacturingYear}</span> : null}
            {v.fuelType ? <span className="chip">{fuelLabels[v.fuelType]}</span> : null}
            {v.powerKw ? <span className="chip">{v.powerKw} kW · {horsePower(v.powerKw)} CP</span> : null}
            {currentKm(v) ? <span className="chip">{km(currentKm(v))}</span> : null}
          </div>
        </div>
        {next && status ? (
          <div className="next-card">
            <small>Următorul termen</small>
            <strong>{documentLabel[next.type]}</strong>
            <div className="when">{fmtDate(next.validUntil, ctx.settings.dateFormat)} · {status.cls === "ok" ? `peste ${status.days} zile` : status.text.toLowerCase()}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Activity({ ctx, cars, all }: { ctx: GarageContext; cars: GarageVehicle[]; all: boolean }) {
  const now = new Date();
  const entries = costEntries(cars, ctx.categories).filter((e) => e.date <= now).slice(0, 8);
  return (
    <div className="card activity">
      <h3>Activitate recentă</h3>
      {entries.length ? entries.map((e) => (
        <div className="act-row" key={`${e.kind}-${e.id}`}>
          <CatBadge categoryKey={e.categoryKey} categories={ctx.categories} />
          <div className="t"><div>{e.title}</div><small>{fmtDate(e.date, ctx.settings.dateFormat)}{all ? ` · ${e.vehicle.plateNumber}` : ""}</small></div>
          <span className="a">{money(e.amount)}</span>
        </div>
      )) : <div className="hint">Nicio activitate încă.</div>}
    </div>
  );
}
