import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Bell, ChevronRight, Download, Eye, Monitor, Moon, Plus, Send, SlidersHorizontal, Sun, Tag, Upload } from "lucide-react";
import { importJsonData } from "@/app/actions";
import {
  createCostCategory,
  testTelegramNotification,
  toggleCostCategory,
  updateCostCategory,
  updateGeneralSettings,
  updateReminderSettings,
  updateTelegramSettings
} from "@/app/settings-actions";
import { AppShell } from "@/components/app-shell";
import { AppLogo } from "@/components/ui/app-logo";
import { CategoryIcon } from "@/components/ui/icons";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { CATEGORY_ICONS, type CostCategory } from "@/lib/cost-categories";
import { activeAlerts, DATE_FORMATS, fmtDate } from "@/lib/garage";
import { loadGarage, type GarageContext } from "@/lib/garage-data";

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["general", "General", SlidersHorizontal],
  ["categories", "Categorii de cost", Tag],
  ["reminders", "Mementouri", Bell],
  ["telegram", "Notificări Telegram", Send],
  ["backup", "Backup & export", Archive]
] as const;

type Params = { section?: string; saved?: string; telegram?: string; import?: string; error?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await loadGarage();
  if (!ctx.isAdmin) redirect("/");
  const params = await searchParams;
  const section = SECTIONS.some(([key]) => key === params.section) ? params.section! : "general";
  const { settings } = ctx;
  const subtitle: Record<string, string> = {
    general: `${{ system: "Temă sistem", light: "Luminoasă", dark: "Întunecată" }[settings.theme] ?? "Temă sistem"} · ${settings.dateFormat === "system" ? "dată dispozitiv" : settings.dateFormat}`,
    categories: `${ctx.categories.length} categorii`,
    reminders: settings.notificationsEnabled ? `zilnic la ${settings.notificationTime}` : "oprite",
    telegram: settings.telegramBotToken && settings.telegramChatId ? "configurat" : "neconfigurat",
    backup: "arhivă .zip, import"
  };
  const current = SECTIONS.find(([key]) => key === section)!;

  return (
    <AppShell active="settings">
      <section className="card page">
        <div className="panel-head"><div><h2>Setări</h2><p>Setări generale ale aplicației · setările fiecărei mașini sunt în Panou → Setări</p></div></div>
        <div className="settings-layout">
          <nav className="ios-group settings-nav">
            {SECTIONS.map(([key, label, Icon]) => (
              <Link key={key} className={`ios-row ${section === key ? "sel" : ""}`} href={`/settings?section=${key}`}>
                <span className="cat-ic" style={{ "--c": "var(--accent)" } as React.CSSProperties}><Icon className="i" /></span>
                <div className="grow">{label}<small>{subtitle[key]}</small></div>
                <ChevronRight className="i chev-r" />
              </Link>
            ))}
          </nav>
          <div>
            <h3 className="settings-h">{current[1]}</h3>
            {params.saved ? <div className="notice ok">Salvat.</div> : null}
            {section === "general" ? <General ctx={ctx} /> : null}
            {section === "categories" ? <Categories categories={ctx.categories} error={params.error} /> : null}
            {section === "reminders" ? <Reminders ctx={ctx} /> : null}
            {section === "telegram" ? <Telegram ctx={ctx} status={params.telegram} /> : null}
            {section === "backup" ? <Backup status={params.import} /> : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function General({ ctx }: { ctx: GarageContext }) {
  const sample = new Date(2012, 3, 18);
  return (
    <form action={updateGeneralSettings}>
      <div className="ios-title">Temă implicită</div>
      <div className="seg-tabs theme-picker" style={{ display: "inline-flex", marginBottom: 6 }}>
        {([["system", "Sistem", Monitor], ["light", "Luminoasă", Sun], ["dark", "Întunecată", Moon]] as const).map(([value, label, Icon]) => (
          <label key={value}><input type="radio" name="theme" value={value} defaultChecked={ctx.settings.theme === value} /><span><Icon className="i" />{label}</span></label>
        ))}
      </div>
      <p className="ios-caption">Butonul cu luna / soarele din bara de sus schimbă tema doar în browserul tău.</p>
      <div className="ios-title">Format dată</div>
      <select className="field" style={{ maxWidth: 420 }} name="dateFormat" defaultValue={ctx.settings.dateFormat}>
        {DATE_FORMATS.map((format) => <option key={format} value={format}>{format === "system" ? `Setările dispozitivului (${fmtDate(sample)})` : `${fmtDate(sample, format)} · ${format}`}</option>)}
      </select>
      <p className="ios-caption">Exemplu cu data de azi: <b>{fmtDate(new Date(), ctx.settings.dateFormat)}</b>. Se aplică în toată aplicația.</p>
      <button className="btn">Salvează</button>
    </form>
  );
}

function Categories({ categories, error }: { categories: CostCategory[]; error?: string }) {
  return (
    <>
      <div className="panel-head" style={{ marginBottom: 12 }}>
        <p style={{ margin: 0 }}>Culoarea și iconița apar în Costuri, Statistici, Rapoarte și Activitate recentă.</p>
        <Modal trigger={<><Plus className="i" />Categorie</>} triggerClassName="btn btn-sm" title="Categorie nouă">
          <form action={createCostCategory}>
            <div className="form"><CategoryFields /></div>
            <ModalFooter />
          </form>
        </Modal>
      </div>
      {error ? <div className="notice bad">Numele categoriei este obligatoriu.</div> : null}
      <div className="ios-group">
        {categories.map((c) => (
          <div className="ios-row" key={c.key} style={{ opacity: c.isActive ? 1 : 0.5 }}>
            <span className="cat-ic" style={{ "--c": c.color } as React.CSSProperties}><CategoryIcon name={c.icon} /></span>
            <div className="grow">{c.name}{c.isActive ? null : <small>ascunsă la adăugare</small>}</div>
            <span className="dot" style={{ background: c.color, width: 14, height: 14 }} />
            {c.id ? (
              <Modal trigger="Editează" triggerClassName="btn-secondary btn-sm" title={`Editează „${c.name}”`}>
                <form action={updateCostCategory.bind(null, c.id)}>
                  <div className="form"><CategoryFields category={c} /></div>
                  <ModalFooter />
                </form>
                <form action={toggleCostCategory.bind(null, c.id)} style={{ marginTop: 10 }}>
                  <button className="link-btn">{c.isActive ? "Ascunde categoria la adăugarea costurilor" : "Afișează din nou categoria"}</button>
                </form>
              </Modal>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function CategoryFields({ category }: { category?: CostCategory }) {
  return (
    <>
      <label className="full">Nume<input className="field" name="name" defaultValue={category?.name ?? ""} required /></label>
      <label>Culoare<input className="field" type="color" name="color" defaultValue={category?.color ?? "#6366f1"} style={{ height: 44, padding: 4 }} /></label>
      <label>
        Iconiță
        <select className="field" name="icon" defaultValue={category?.icon ?? "tag"}>
          {CATEGORY_ICONS.map((icon) => <option key={icon} value={icon}>{ICON_NAMES[icon]}</option>)}
        </select>
      </label>
      <div className="full" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATEGORY_ICONS.map((icon) => <span key={icon} className="cat-ic" title={ICON_NAMES[icon]} style={{ "--c": "var(--accent)" } as React.CSSProperties}><CategoryIcon name={icon} /></span>)}
      </div>
    </>
  );
}

const ICON_NAMES: Record<(typeof CATEGORY_ICONS)[number], string> = {
  shield: "Scut", wrench: "Cheie", hammer: "Ciocan", clipboard: "Clipboard", ticket: "Bilet", landmark: "Bancă", fuel: "Pompă", zap: "Fulger", tire: "Anvelopă", sparkles: "Steluțe", droplets: "Picături", parking: "Parcare", repeat: "Abonament", kit: "Trusă", gavel: "Ciocănel", tag: "Etichetă"
};

function Reminders({ ctx }: { ctx: GarageContext }) {
  const { settings } = ctx;
  return (
    <form action={updateReminderSettings}>
      <div className="ios-group">
        <label className="ios-row"><div className="grow">Notificări activate<small>Telegram; alertele din aplicație rămân oricum</small></div><input type="checkbox" className="switch" name="notificationsEnabled" defaultChecked={settings.notificationsEnabled} /></label>
        <label className="ios-row"><div className="grow">Ora notificării</div><input className="time" type="time" name="notificationTime" defaultValue={settings.notificationTime} /></label>
        <div className="ios-row"><div className="grow">Vehicule<small>{ctx.vehicles.filter((v) => v.remindersEnabled).length} din {ctx.vehicles.length} cu mementouri active · se schimbă din Setările fiecărei mașini</small></div></div>
      </div>
      <p className="ios-caption">Vei fi notificat la {settings.notificationTime} în ziua în care un memento devine scadent.</p>
      <div className="ios-group">
        <div className="ios-row" style={{ display: "block" }}><b>Memento după dată</b><small style={{ display: "block", color: "var(--muted)", margin: "4px 0 10px" }}>Cu câte zile înainte de termen elementul devine prioritate ridicată (roșu)</small><input className="field" type="number" min="0" max="365" name="highPriorityDays" defaultValue={settings.highPriorityDays} /></div>
        <div className="ios-row" style={{ display: "block" }}><b>Memento după kilometraj</b><small style={{ display: "block", color: "var(--muted)", margin: "4px 0 10px" }}>Cu câți km înainte de „următoarea revizie” elementul apare în Alerte</small><input className="field" type="number" min="0" name="odometerReminderKm" defaultValue={settings.odometerReminderKm} /></div>
      </div>
      <button className="btn" style={{ marginTop: 16 }}>Salvează</button>
    </form>
  );
}

function Telegram({ ctx, status }: { ctx: GarageContext; status?: string }) {
  const { settings } = ctx;
  const sample = activeAlerts(ctx.vehicles, settings, ctx.dismissed)[0];
  const notices: Record<string, [string, string]> = {
    ok: ["ok", "Mesajul de test a fost trimis."],
    failed: ["bad", "Telegram a refuzat mesajul. Verifică tokenul și chat ID-ul."],
    missing: ["bad", "Completează mai întâi tokenul și chat ID-ul."]
  };
  return (
    <div className="tg-layout">
      <div>
        {status && notices[status] ? <div className={`notice ${notices[status][0]}`}>{notices[status][1]}</div> : null}
        <form action={updateTelegramSettings}>
          <div className="ios-group">
            <div className="ios-row" style={{ display: "block" }}>
              <b>Bot token</b>
              <input className="field" style={{ marginTop: 8 }} type="password" name="telegramBotToken" autoComplete="off" placeholder={settings.telegramBotToken ? "•••••••• salvat · lasă gol ca să-l păstrezi" : "123456789:AA…"} />
              {settings.telegramBotToken ? <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 13, color: "var(--muted)" }}><input type="checkbox" name="clearToken" />Șterge tokenul salvat</label> : null}
            </div>
            <div className="ios-row" style={{ display: "block" }}><b>Chat ID</b><input className="field" style={{ marginTop: 8 }} name="telegramChatId" defaultValue={settings.telegramChatId ?? ""} placeholder="ex. 123456789 sau -100… pentru grup" /></div>
          </div>
          <button className="btn" style={{ marginTop: 14 }}>Salvează</button>
        </form>
        <form action={testTelegramNotification} style={{ marginTop: 10 }}><button className="btn-secondary btn-sm"><Send className="i" />Trimite mesaj de test</button></form>
        <h3 className="section-title">Cum le obții</h3>
        <ol className="steps">
          <li>Deschide <b>@BotFather</b> în Telegram, trimite <code>/newbot</code> și copiază tokenul primit.</li>
          <li>Trimite un mesaj botului tău (sau adaugă-l într-un grup).</li>
          <li>Chat ID-ul îl afli cu <b>@userinfobot</b>.</li>
        </ol>
        <p className="ios-caption">Notificările pe email (Gmail) sunt scoase deocamdată.</p>
      </div>
      <div className="tg-phone">
        <div className="tg-head"><span className="tg-avatar"><AppLogo id="tg" /></span><div><b>Garaj Bot</b><small>bot</small></div></div>
        <div className="tg-chat">
          <div className="tg-msg">
            ⚠️ <b>Alertă Garaj</b><br /><br />
            <b>{sample ? `${sample.title} ${sample.status.days < 0 ? "a expirat" : "expiră"}` : "RCA expiră în 7 zile"}</b><br />
            🚗 {sample?.subject ?? "TM19HEY"}<br />
            📅 {fmtDate(sample?.date ?? new Date(), settings.dateFormat)}
            <span className="tg-time">{settings.notificationTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Backup({ status }: { status?: string }) {
  const notices: Record<string, [string, string]> = {
    ok: ["ok", "Backup-ul a fost importat."],
    missing: ["bad", "Alege un fișier."],
    invalid: ["bad", "Fișierul nu este un backup Garaj valid."],
    empty: ["bad", "Backup-ul nu conține mașini."]
  };
  return (
    <>
      {status && notices[status] ? <div className={`notice ${notices[status][0]}`}>{notices[status][1]}</div> : null}
      <div className="grid2">
        <div className="box">
          <h3><Archive className="i" />Export</h3>
          <p className="notes" style={{ marginBottom: 14 }}>O singură arhivă <b>.zip</b> cu tot ce e în aplicație: <code>garaj.json</code> (pentru restaurare) și tabele CSV pentru costuri și documente, care se deschid direct în Excel.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-sm" href="/api/export/zip"><Download className="i" />Descarcă arhiva (.zip)</a>
            <a className="btn-secondary btn-sm" href="/api/export/json">Doar date (.json)</a>
          </div>
        </div>
        <div className="box">
          <h3><Upload className="i" />Import</h3>
          <p className="notes" style={{ marginBottom: 14 }}>Restaurează dintr-o arhivă <b>.zip</b> sau dintr-un backup mai vechi <b>.grj / .json</b>. Mașinile existente cu același număr sunt înlocuite cu datele din fișier.</p>
          <form action={importJsonData} style={{ display: "grid", gap: 10 }}>
            <input className="field" type="file" name="jsonFile" accept=".zip,.json,.grj" required />
            <button className="btn btn-sm" style={{ justifySelf: "start" }}><Upload className="i" />Importă</button>
          </form>
        </div>
      </div>
      <p className="ios-caption"><Eye className="i" style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> Parolele utilizatorilor și tokenul Telegram nu sunt incluse în export. Conturile create la import primesc o parolă aleatorie; setează parola din Șoferi → Editează.</p>
    </>
  );
}
