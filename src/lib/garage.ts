import { DocumentType, Prisma } from "@prisma/client";
import { DOCUMENT_CATEGORY_KEY, EXPENSE_CATEGORY_KEY, type CostCategory } from "@/lib/cost-categories";
import { latestOdometer, odometerReminderForVehicle } from "@/lib/odometer-reminders";

export const vehicleInclude = {
  driver: true,
  documents: true,
  expenses: true,
  services: true,
  tires: true,
  paymentPlans: { include: { installments: { orderBy: { installmentNumber: "asc" } } } }
} satisfies Prisma.VehicleInclude;

export type GarageVehicle = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;
export type GarageDriver = NonNullable<GarageVehicle["driver"]>;

export type DisplaySettings = {
  dateFormat: string;
  highPriorityDays: number;
  odometerReminderKm: number;
};

export const DAY = 86_400_000;
export const DATE_FORMATS = ["system", "YYYY-MM-DD", "YYYY-DD-MM", "MM-DD-YYYY", "DD-MM-YYYY", "DD.MM.YYYY"] as const;
export const ALERT_DOCUMENT_TYPES: DocumentType[] = ["ITP", "RCA", "CASCO", "ROVINIETA", "FIRST_AID_KIT", "FIRE_EXTINGUISHER"];
export const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

export const documentLabel: Record<DocumentType, string> = {
  ITP: "ITP",
  RCA: "RCA",
  CASCO: "CASCO",
  ROVINIETA: "Rovinietă",
  FIRST_AID_KIT: "Trusă medicală",
  FIRE_EXTINGUISHER: "Extinctor",
  WARRANTY: "Garanție",
  CAR_LOAN: "Rată mașină",
  CASCO_RATE: "Rată CASCO",
  DRIVER_LICENSE: "Permis de conducere",
  ID_CARD: "Carte de identitate"
};

export function fmtDate(value: Date | string | null | undefined, format = "system") {
  if (!value) return "—";
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  switch (format) {
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    case "YYYY-DD-MM": return `${yyyy}-${dd}-${mm}`;
    case "MM-DD-YYYY": return `${mm}-${dd}-${yyyy}`;
    case "DD-MM-YYYY": return `${dd}-${mm}-${yyyy}`;
    case "DD.MM.YYYY": return `${dd}.${mm}.${yyyy}`;
    default: return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
  }
}

export const dateInput = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "");
export const money = (value: number) => `${Math.round(value).toLocaleString("ro-RO")} RON`;
export const km = (value: number | null | undefined) => (value || value === 0 ? `${Number(value).toLocaleString("ro-RO")} km` : "—");
export const num = (value: unknown) => (value === null || value === undefined || value === "" ? 0 : Number(value));
export const daysUntil = (value: Date | string, now = new Date()) => Math.round((new Date(value).getTime() - now.getTime()) / DAY);
export const horsePower = (kw: number | null | undefined) => (kw ? Math.round(kw * 1.36) : null);

export type Status = { cls: "ok" | "warn" | "bad"; text: string; days: number };

export function docStatus(validUntil: Date | string, highPriorityDays: number, now = new Date()): Status {
  const days = daysUntil(validUntil, now);
  if (days < 0) return { cls: "bad", text: `Expirat de ${-days} zile`, days };
  if (days <= highPriorityDays) return { cls: "bad", text: `Expiră în ${days} zile`, days };
  if (days <= 30) return { cls: "warn", text: `Expiră în ${days} zile`, days };
  return { cls: "ok", text: "Valabil", days };
}

export function latestDocuments(vehicle: Pick<GarageVehicle, "documents">) {
  const byType = new Map<DocumentType, GarageVehicle["documents"][number]>();
  for (const doc of vehicle.documents) {
    const current = byType.get(doc.type);
    if (!current || doc.validUntil > current.validUntil) byType.set(doc.type, doc);
  }
  return [...byType.values()].sort((a, b) => a.validUntil.getTime() - b.validUntil.getTime());
}

export function currentKm(vehicle: GarageVehicle) {
  return latestOdometer(vehicle);
}

export function categoryFor(key: string, categories: CostCategory[]) {
  return categories.find((category) => category.key === key) ?? categories.find((category) => category.key === "other") ?? categories[0];
}

export function expenseCategoryKey(expense: GarageVehicle["expenses"][number], categories: Array<CostCategory & { id?: string }>) {
  const configured = expense.categoryConfigId ? categories.find((category) => category.id === expense.categoryConfigId) : undefined;
  return configured?.key ?? EXPENSE_CATEGORY_KEY[expense.category];
}

export type CostEntry = {
  kind: "document" | "expense" | "service" | "tire";
  id: string;
  vehicle: GarageVehicle;
  date: Date;
  categoryKey: string;
  title: string;
  amount: number;
  km: number | null;
};

const shortNote = (note: string | null) => (note && note.length < 48 && !/^https?:/i.test(note) ? note : null);

export function costEntries(vehicles: GarageVehicle[], categories: Array<CostCategory & { id?: string }>): CostEntry[] {
  const entries: CostEntry[] = [];
  for (const vehicle of vehicles) {
    for (const doc of vehicle.documents) {
      if (num(doc.cost) > 0) entries.push({ kind: "document", id: doc.id, vehicle, date: doc.issuedAt ?? doc.validUntil, categoryKey: DOCUMENT_CATEGORY_KEY[doc.type], title: documentLabel[doc.type], amount: num(doc.cost), km: null });
    }
    for (const expense of vehicle.expenses) {
      const key = expenseCategoryKey(expense, categories);
      entries.push({ kind: "expense", id: expense.id, vehicle, date: expense.occurredAt, categoryKey: key, title: shortNote(expense.notes) ?? categoryFor(key, categories).name, amount: num(expense.amount), km: expense.odometerKm });
    }
    for (const service of vehicle.services) {
      entries.push({ kind: "service", id: service.id, vehicle, date: service.servicedAt, categoryKey: "service", title: "Revizie", amount: num(service.cost), km: service.odometerKm });
    }
    for (const tire of vehicle.tires) {
      entries.push({ kind: "tire", id: tire.id, vehicle, date: tire.purchasedAt, categoryKey: "tires", title: `${tire.brand} ${tire.model ?? ""}`.trim(), amount: num(tire.cost), km: null });
    }
  }
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export type Deadline = {
  key: string;
  kind: "document" | "person" | "odometer";
  title: string;
  subject: string;
  date: Date;
  status: Status;
  vehicle?: GarageVehicle;
};

export function deadlines(vehicles: GarageVehicle[], settings: DisplaySettings, now = new Date()): Deadline[] {
  const out: Deadline[] = [];
  const seenDrivers = new Set<string>();
  for (const vehicle of vehicles) {
    const subject = `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`;
    for (const doc of latestDocuments(vehicle)) {
      if (!ALERT_DOCUMENT_TYPES.includes(doc.type)) continue;
      out.push({ key: `doc:${doc.id}`, kind: "document", title: documentLabel[doc.type], subject, date: doc.validUntil, status: docStatus(doc.validUntil, settings.highPriorityDays, now), vehicle });
    }
    const odometer = odometerReminderForVehicle(vehicle, settings.odometerReminderKm);
    if (odometer) {
      out.push({
        key: `odo:${odometer.service.id}`,
        kind: "odometer",
        title: `Revizie la ${odometer.targetOdometer.toLocaleString("ro-RO")} km`,
        subject: `${subject} · ${odometer.isOverdue ? `${Math.abs(odometer.remainingKm).toLocaleString("ro-RO")} km peste` : `${odometer.remainingKm.toLocaleString("ro-RO")} km rămași`}`,
        date: now,
        status: { cls: odometer.isOverdue ? "bad" : "warn", text: odometer.isOverdue ? "Revizie depășită" : `${odometer.remainingKm.toLocaleString("ro-RO")} km rămași`, days: 0 },
        vehicle
      });
    }
    const driver = vehicle.driver;
    if (driver && !seenDrivers.has(driver.id)) {
      seenDrivers.add(driver.id);
      const name = `${driver.firstName} ${driver.lastName}`;
      if (driver.licenseExpiresAt) out.push({ key: `lic:${driver.id}:${dateInput(driver.licenseExpiresAt)}`, kind: "person", title: "Permis de conducere", subject: name, date: driver.licenseExpiresAt, status: docStatus(driver.licenseExpiresAt, settings.highPriorityDays, now) });
      if (driver.idCardExpiresAt) out.push({ key: `ci:${driver.id}:${dateInput(driver.idCardExpiresAt)}`, kind: "person", title: "Carte de identitate", subject: name, date: driver.idCardExpiresAt, status: docStatus(driver.idCardExpiresAt, settings.highPriorityDays, now) });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function dismissedKeys(value: Prisma.JsonValue | undefined) {
  return new Set(Array.isArray(value) ? value.map(String) : []);
}

export function activeAlerts(vehicles: GarageVehicle[], settings: DisplaySettings, dismissed: Set<string>) {
  return deadlines(vehicles, settings).filter((item) => item.status.cls !== "ok" && !dismissed.has(item.key));
}

export const initials = (person: { firstName: string; lastName?: string | null }) => `${person.firstName[0] ?? ""}${(person.lastName ?? " ")[0] ?? ""}`.toUpperCase();
