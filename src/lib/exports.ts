import type { CostCategory } from "@/lib/cost-categories";
import { categoryFor, dateInput, documentLabel, expenseCategoryKey, type CostEntry, type GarageVehicle } from "@/lib/garage";
import { prisma } from "@/lib/prisma";

const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export const toCsv = (rows: unknown[][]) => `﻿${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`;

export function costsCsv(entries: CostEntry[], categories: CostCategory[]) {
  return toCsv([
    ["Data", "Mașină", "Categorie", "Descriere", "Kilometraj", "Sumă RON"],
    ...entries.map((e) => [dateInput(e.date), e.vehicle.plateNumber, categoryFor(e.categoryKey, categories).name, e.title, e.km ?? "", e.amount.toFixed(2)])
  ]);
}

export function documentsCsv(vehicles: GarageVehicle[]) {
  return toCsv([
    ["Mașină", "Document", "Emis", "Valabil până la", "Cost RON"],
    ...vehicles.flatMap((v) => v.documents.map((d) => [v.plateNumber, documentLabel[d.type], dateInput(d.issuedAt), dateInput(d.validUntil), d.cost?.toString() ?? ""]))
  ]);
}

const personFields = {
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  licenseCategory: true,
  licenseIssuedAt: true,
  licenseExpiresAt: true,
  idCardIssuedAt: true,
  idCardExpiresAt: true
} as const;

// Full backup without passwords or the Telegram token. formatVersion 5 adds categories and fuel details.
export async function backupPayload(categories: Array<CostCategory & { id?: string }>) {
  const [vehicles, users, settings] = await Promise.all([
    prisma.vehicle.findMany({
      include: {
        documents: true,
        expenses: true,
        services: true,
        tires: true,
        paymentPlans: { include: { installments: { orderBy: { installmentNumber: "asc" } } } },
        driver: { select: personFields }
      }
    }),
    prisma.user.findMany({ select: personFields }),
    prisma.appSetting.findUnique({ where: { id: "default" } })
  ]);

  return {
    formatVersion: 5,
    exportedAt: new Date().toISOString(),
    vehicles: vehicles.map((v) => ({
      ...v,
      expenses: v.expenses.map((e) => ({ ...e, categoryKey: expenseCategoryKey({ ...e } as GarageVehicle["expenses"][number], categories) }))
    })),
    users,
    expenseCategories: categories.map(({ key, name, color, icon, sortOrder, isActive }) => ({ key, name, color, icon, sortOrder, isActive })),
    preferences: settings
      ? { theme: settings.theme, dateFormat: settings.dateFormat, notificationsEnabled: settings.notificationsEnabled, notificationTime: settings.notificationTime, highPriorityDays: settings.highPriorityDays, odometerReminderKm: settings.odometerReminderKm }
      : null
  };
}
