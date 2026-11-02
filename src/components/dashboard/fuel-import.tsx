"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { Check, Download, List, Upload } from "lucide-react";
import { importFuelEntries, type FuelImportRow } from "@/app/settings-actions";

const DAY = 86_400_000;
type FieldKey = "date" | "qty" | "km" | "price" | "total" | "station" | "socStart" | "socEnd" | "duration";

const FIELDS: Array<[FieldKey, string, boolean, RegExp]> = [
  ["date", "Data", true, /chargestartdate|^data$|^date|start.?date|data/],
  ["qty", "Cantitate (kWh / L)", true, /energyrecovered|kwh|litri|cantitate|quantity|volume|energy/],
  ["km", "Kilometraj", false, /mileageatstart|^km$|kilometraj|odometer|mileage/],
  ["price", "Preț / unitate", false, /pret.?unitar|unit.?price|price.?per|pret/],
  ["total", "Total plătit", false, /^total|cost|suma|amount|paid/],
  ["station", "Stație / locație", false, /statie|station|location|locatie|loc/],
  ["socStart", "Baterie la start (%)", false, /startbatterylevel|soc.?start|start.?soc/],
  ["socEnd", "Baterie la final (%)", false, /endbatterylevel|soc.?end|end.?soc/],
  ["duration", "Durată (min)", false, /chargeduration|durata|duration/]
];

function parseNum(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const s = value.trim().replace(/\s/g, "");
  const n = Number(s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const s = value.trim();
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) return new Date(Math.round((Number(s) - 25569) * DAY));
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (m) {
    const [, a, b, y, h = "12", mi = "0", se = "0", ap] = m;
    // US exports carry AM/PM and put the month first; otherwise assume day first (RO).
    let month = Number(ap ? a : b);
    let day = Number(ap ? b : a);
    if (month > 12) [month, day] = [day, month];
    let hour = Number(h);
    if (ap) hour = (hour % 12) + (/pm/i.test(ap) ? 12 : 0);
    return new Date(Number(y), month - 1, day, hour, Number(mi), Number(se));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Minimal .xlsx reader: first worksheet, shared strings and inline strings.
async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
  const shared: string[] = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    for (const si of Array.from(xml(await sharedFile.async("string")).getElementsByTagName("si"))) {
      shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    }
  }
  const sheet = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))[0];
  if (!sheet) return [];
  const colIndex = (ref: string) => ref.replace(/\d/g, "").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return Array.from(xml(await sheet.async("string")).getElementsByTagName("row")).map((rowEl) => {
    const out: string[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName("c"))) {
      const type = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const value = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? c.getElementsByTagName("t")[0]?.textContent ?? "" : v;
      out[colIndex(c.getAttribute("r") ?? "A1")] = value;
    }
    return Array.from(out, (x) => x ?? "");
  });
}

type Loaded = { fileName: string; headers: string[]; rows: string[][]; map: Record<FieldKey, number>; preset: string | null };

export function FuelImport({ vehicleId, electric, trigger }: { vehicleId: string; electric: boolean; trigger: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const unit = electric ? "kWh" : "L";

  async function onFile(file: File) {
    setMessage(null);
    try {
      const table = /\.xlsx?$/i.test(file.name) ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text());
      const rows = table.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
      const headers = (rows.shift() ?? []).map((h) => (h ?? "").trim());
      const map = {} as Record<FieldKey, number>;
      for (const [key, , , re] of FIELDS) {
        const used = new Set(Object.values(map));
        map[key] = headers.findIndex((h, i) => !used.has(i) && re.test(h.toLowerCase().replace(/[^a-z0-9ăâîșț_ ]/g, "")));
      }
      const preset = headers.includes("chargeStartDate") && headers.includes("chargeEnergyRecovered") ? "My Renault · export încărcări" : null;
      setLoaded({ fileName: file.name, headers, rows, map, preset });
    } catch {
      setMessage("Fișierul nu a putut fi citit. Folosește .csv sau .xlsx.");
    }
  }

  const prepared = useMemo(() => {
    if (!loaded) return { rows: [] as FuelImportRow[], invalid: 0, noKm: 0, noPrice: 0 };
    const get = (r: string[], key: FieldKey) => (loaded.map[key] >= 0 ? r[loaded.map[key]] : undefined);
    const defaultPrice = parseNum(price);
    const rows: FuelImportRow[] = [];
    let invalid = 0;
    for (const r of loaded.rows) {
      const date = parseDate(get(r, "date"));
      const quantity = parseNum(get(r, "qty"));
      if (!date || !quantity || quantity <= 0) { invalid++; continue; }
      const total = parseNum(get(r, "total"));
      const unitPrice = parseNum(get(r, "price")) ?? (total ? total / quantity : defaultPrice);
      rows.push({
        date: date.toISOString(),
        quantity,
        odometerKm: parseNum(get(r, "km")),
        unitPrice,
        total: total ?? (unitPrice ? quantity * unitPrice : null),
        station: get(r, "station")?.trim() || null,
        socStart: parseNum(get(r, "socStart")),
        socEnd: parseNum(get(r, "socEnd")),
        durationMin: parseNum(get(r, "duration")),
        importKey: `${date.toISOString().slice(0, 16)}|${quantity}`
      });
    }
    return { rows, invalid, noKm: rows.filter((r) => r.odometerKm === null).length, noPrice: rows.filter((r) => !r.total).length };
  }, [loaded, price]);

  async function run() {
    setBusy(true);
    const result = await importFuelEntries(vehicleId, prepared.rows);
    setBusy(false);
    setLoaded(null);
    setMessage(`${result.imported} ${electric ? "încărcări" : "alimentări"} importate${result.skipped ? ` · ${result.skipped} existau deja` : ""}.`);
    router.refresh();
  }

  function downloadTemplate() {
    const csv = "data,km,cantitate,pret_unitar,total,statie\n21.10.2026,16556,41.9,1.10,,Acasă\n12.10.2026,16385,33.35,,58.40,Kaufland Timișoara\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "garaj-sablon-alimentari.csv";
    a.click();
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => { setMessage(null); dialog.current?.showModal(); }}>{trigger}</button>
      <dialog ref={dialog} className="modal-dialog wide" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="card modal">
          <h2>Importă {electric ? "încărcări" : "alimentări"}</h2>
          {message ? <div className="notice ok" style={{ marginTop: 10 }}>{message}</div> : null}
          {!loaded ? (
            <>
              <p className="sub">Din exportul aplicației pe care o folosești acum (CSV sau Excel)</p>
              <label className="dropzone">
                <input type="file" accept=".csv,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
                <Upload className="i" /><span>Alege fișierul .csv / .xlsx</span>
              </label>
              <div className="import-help">
                <div><Check className="i" /><span><b>My Renault</b> (export „Charges”) e recunoscut automat: kWh, procent baterie, durată, kilometraj.</span></div>
                <div><List className="i" /><span>Orice alt fișier: după încărcare alegi care coloană e data, cantitatea, kilometrajul, prețul.</span></div>
                <div><Download className="i" /><span>Sau pornești de la <button type="button" className="link-btn" onClick={downloadTemplate}>șablonul CSV Garaj</button>: <code>data, km, cantitate, pret_unitar, total, statie</code></span></div>
              </div>
              <div className="foot"><button type="button" className="btn-secondary" onClick={() => dialog.current?.close()}>Închide</button></div>
            </>
          ) : (
            <>
              <p className="sub">{loaded.fileName} · {loaded.rows.length} rânduri {loaded.preset ? <span className="pill ok">{loaded.preset}</span> : <span className="pill info">Format necunoscut · verifică coloanele</span>}</p>
              <div className="form">
                <label className="full">Preț implicit / {unit} (RON)
                  <input className="field" type="number" step="0.01" placeholder={electric ? "ex. 1.10 tarif acasă" : "ex. 7.50"} value={price} onChange={(e) => setPrice(e.target.value)} />
                  <small style={{ fontWeight: 500 }}>Folosit doar unde fișierul nu are preț sau total.{prepared.noPrice ? ` ${prepared.noPrice} rânduri fără cost.` : ""}</small>
                </label>
              </div>
              <details className="history" open={!loaded.preset}>
                <summary>Potrivirea coloanelor</summary>
                <div className="form" style={{ marginTop: 10 }}>
                  {FIELDS.map(([key, label, required]) => (
                    <label key={key}>{label}{required ? " *" : ""}
                      <select className="field" value={loaded.map[key]} onChange={(e) => setLoaded({ ...loaded, map: { ...loaded.map, [key]: Number(e.target.value) } })}>
                        <option value={-1}>— lipsește —</option>
                        {loaded.headers.map((h, i) => <option key={i} value={i}>{h || `Coloana ${i + 1}`}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
              <div className="import-stats">
                <span className="pill ok">{prepared.rows.length} de importat</span>
                {prepared.invalid ? <span className="pill warn">{prepared.invalid} fără dată sau cantitate</span> : null}
                {prepared.noKm ? <span className="pill muted">{prepared.noKm} fără kilometraj</span> : null}
                <span className="pill muted">cele deja importate sunt sărite</span>
              </div>
              <div className="table-wrap box" style={{ padding: "0 4px", marginTop: 10 }}>
                <table className="data">
                  <thead><tr><th>Data</th><th>Cantitate</th><th>Km</th><th>Baterie</th><th>Durată</th><th>Cost</th></tr></thead>
                  <tbody>
                    {prepared.rows.slice(0, 6).map((r) => (
                      <tr key={r.importKey}>
                        <td>{fmt(r.date)}</td>
                        <td>{r.quantity.toLocaleString("ro-RO")} {unit}</td>
                        <td>{r.odometerKm ? `${r.odometerKm.toLocaleString("ro-RO")} km` : "—"}</td>
                        <td>{r.socStart !== null && r.socEnd !== null ? `${r.socStart}% → ${r.socEnd}%` : "—"}</td>
                        <td>{r.durationMin ? `${r.durationMin} min` : "—"}</td>
                        <td>{r.total ? `${Math.round(r.total).toLocaleString("ro-RO")} RON` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prepared.rows.length > 6 ? <p className="ios-caption">… și încă {prepared.rows.length - 6} rânduri</p> : null}
              <div className="foot">
                <button type="button" className="btn-secondary" onClick={() => setLoaded(null)}>Alt fișier</button>
                <button type="button" className="btn" disabled={!prepared.rows.length || busy} onClick={run}><Check className="i" />{busy ? "Se importă…" : `Importă ${prepared.rows.length}`}</button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
