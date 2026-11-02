import Link from "next/link";
import { Bell, Calendar, Check, ChevronLeft, ChevronRight, FileText, Gauge, IdCard, List } from "lucide-react";
import { dismissAlert, restoreAlerts } from "@/app/settings-actions";
import { AppShell } from "@/components/app-shell";
import { deadlines, fmtDate, type Deadline } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";

export const dynamic = "force-dynamic";

const FILTERS = [["attention", "Necesită atenție"], ["expired", "Expirate"], ["all", "Toate termenele"]] as const;
const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ mode?: string; filter?: string; month?: string }> }) {
  const ctx = await loadGarage();
  const params = await searchParams;
  const mode = params.mode === "calendar" ? "calendar" : "list";
  const filter = FILTERS.some(([key]) => key === params.filter) ? params.filter! : "attention";
  const all = deadlines(ctx.vehicles, ctx.settings).filter((item) => !ctx.dismissed.has(item.key));
  const list = filter === "attention" ? all.filter((x) => x.status.cls !== "ok") : filter === "expired" ? all.filter((x) => x.status.days < 0 && x.kind !== "odometer") : all;
  const link = (next: Record<string, string>) => `/alerts?${new URLSearchParams({ mode, filter, ...(params.month ? { month: params.month } : {}), ...next })}`;

  return (
    <AppShell active="alerts">
      <section className="card page">
        <div className="panel-head">
          <div><h2>Alerte</h2><p>Documentele mașinilor și ale șoferilor · roșu sub {ctx.settings.highPriorityDays} zile, portocaliu sub 30</p></div>
          <div className="actions">
            {mode === "list" ? (
              <div className="seg-tabs">{FILTERS.map(([key, label]) => <Link key={key} href={link({ filter: key })} className={filter === key ? "active" : ""}>{label}</Link>)}</div>
            ) : null}
            <div className="seg-tabs">
              <Link href={link({ mode: "list" })} className={mode === "list" ? "active" : ""}><List className="i" />Listă</Link>
              <Link href={link({ mode: "calendar" })} className={mode === "calendar" ? "active" : ""}><Calendar className="i" />Calendar</Link>
            </div>
          </div>
        </div>

        {mode === "calendar" ? <CalendarView items={all} month={params.month} dateFormat={ctx.settings.dateFormat} link={link} /> : (
          list.length ? list.map((item) => <AlertRow key={item.key} item={item} dateFormat={ctx.settings.dateFormat} />) : <div className="hint"><Check className="i" /> Nimic de rezolvat.</div>
        )}

        {ctx.dismissed.size && ctx.isAdmin ? (
          <form action={restoreAlerts} className="ios-caption">
            {ctx.dismissed.size} alerte marcate ca rezolvate. <button className="link-btn">Afișează din nou</button>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}

function AlertRow({ item, dateFormat }: { item: Deadline; dateFormat: string }) {
  const Icon = item.kind === "document" ? FileText : item.kind === "odometer" ? Gauge : IdCard;
  return (
    <div className="alert-row">
      <div className={`alert-ic ${item.status.cls}`}><Icon className="i" /></div>
      <div className="grow" style={{ flex: 1, minWidth: 0 }}>
        <b>{item.title}</b>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{item.subject}{item.kind !== "odometer" ? ` · ${fmtDate(item.date, dateFormat)}` : ""}</div>
      </div>
      <span className={`pill ${item.status.cls}`}>{item.status.cls === "ok" ? `peste ${item.status.days} zile` : item.status.text}</span>
      {item.status.cls !== "ok" ? (
        <form action={dismissAlert.bind(null, item.key)}><button className="btn-secondary btn-sm"><Check className="i" />Rezolvat</button></form>
      ) : null}
    </div>
  );
}

function CalendarView({ items, month, dateFormat, link }: { items: Deadline[]; month?: string; dateFormat: string; link: (next: Record<string, string>) => string }) {
  const today = new Date();
  const match = month?.match(/^(\d{4})-(\d{2})$/);
  const first = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const dated = items.filter((x) => x.kind !== "odometer");
  const events = dated.flatMap((x) => {
    const notify = new Date(x.date);
    notify.setDate(notify.getDate() - 30);
    return [{ date: new Date(x.date), kind: "due" as const, x }, { date: notify, kind: "notify" as const, x }];
  });
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const monthEvents = events.filter((e) => e.kind === "due" && e.date.getFullYear() === y && e.date.getMonth() === m);
  const upcoming = dated.filter((x) => x.status.days >= 0).slice(0, 4);
  const label = first.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
  const short = (x: Deadline) => x.vehicle?.plateNumber ?? x.subject.split(" ")[0];

  return (
    <>
      <div className="cal-head">
        <Link className="round-btn" href={link({ month: key(new Date(y, m - 1, 1)) })}><ChevronLeft className="i" /></Link>
        <h3>{label.charAt(0).toUpperCase() + label.slice(1)}</h3>
        <Link className="round-btn" href={link({ month: key(new Date(y, m + 1, 1)) })}><ChevronRight className="i" /></Link>
        <Link className="btn-secondary btn-sm" href={link({ month: key(today) })}>Azi</Link>
        <span className="cal-legend">
          <span className="cal-ev bad">Expiră / expirat</span>
          <span className="cal-ev warn">Sub 30 zile</span>
          <span className="cal-ev ok">Termen</span>
          <span className="cal-ev notify"><Bell className="i" />Memento</span>
        </span>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((d) => <div className="cal-wd" key={d}>{d}</div>)}
        {days.map((d) => (
          <div key={d.toISOString()} className={`cal-cell ${d.getMonth() !== m ? "out" : ""} ${same(d, today) ? "today" : ""}`}>
            <span className="cal-day">{d.getDate()}</span>
            {events.filter((e) => same(e.date, d)).map((e) => e.kind === "due"
              ? <span key={`d-${e.x.key}`} className={`cal-ev ${e.x.status.cls}`} title={`${e.x.title} · ${e.x.subject}`}>{e.x.title} · {short(e.x)}</span>
              : <span key={`n-${e.x.key}`} className="cal-ev notify" title={`Memento pentru ${e.x.title}`}><Bell className="i" />{e.x.title}</span>)}
          </div>
        ))}
      </div>
      {monthEvents.length ? (
        <div className="cal-list">{monthEvents.map((e) => <AlertRow key={e.x.key} item={e.x} dateFormat={dateFormat} />)}</div>
      ) : (
        <div className="proposal" style={{ marginTop: 14 }}><Calendar className="i" /><div>Niciun termen în această lună.{upcoming.length ? <> Următoarele: {upcoming.map((x, i) => <span key={x.key}>{i ? " · " : ""}<b>{x.title}</b> {short(x)} ({fmtDate(x.date, dateFormat)})</span>)}</> : null}</div></div>
      )}
    </>
  );
}
