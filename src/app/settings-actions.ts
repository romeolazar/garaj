"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ICONS, expenseEnumForKey } from "@/lib/cost-categories";
import { DATE_FORMATS, dismissedKeys } from "@/lib/garage";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}

async function requireVehicleAccess(vehicleId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") return session;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { driverId: true } });
  if (!vehicle || vehicle.driverId !== session.user.id) redirect("/");
  return session;
}

const settingsDefaults = { id: "default" };

export async function updateGeneralSettings(formData: FormData) {
  await requireAdmin();
  const theme = ["system", "light", "dark"].includes(text(formData, "theme") ?? "") ? text(formData, "theme")! : "system";
  const dateFormat = (DATE_FORMATS as readonly string[]).includes(text(formData, "dateFormat") ?? "") ? text(formData, "dateFormat")! : "system";
  await prisma.appSetting.upsert({ where: { id: "default" }, update: { theme, dateFormat }, create: { ...settingsDefaults, theme, dateFormat } });
  revalidatePath("/", "layout");
  redirect("/settings?section=general&saved=1");
}

export async function updateReminderSettings(formData: FormData) {
  await requireAdmin();
  const timeValue = text(formData, "notificationTime") ?? "09:00";
  const notificationTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue) ? timeValue : "09:00";
  const clamp = (value: string | undefined, fallback: number, max: number) => Math.max(0, Math.min(Number.parseInt(value ?? "", 10) || fallback, max));
  const data = {
    notificationsEnabled: formData.has("notificationsEnabled"),
    notificationTime,
    highPriorityDays: clamp(text(formData, "highPriorityDays"), 14, 365),
    odometerReminderKm: clamp(text(formData, "odometerReminderKm"), 500, 100000)
  };
  await prisma.appSetting.upsert({ where: { id: "default" }, update: data, create: { ...settingsDefaults, ...data } });

  // Move pending reminders to the new time of day.
  const [hours, minutes] = notificationTime.split(":").map(Number);
  const pending = await prisma.reminder.findMany({ where: { status: "PENDING" }, select: { id: true, notifyAt: true } });
  for (const reminder of pending) {
    const notifyAt = new Date(reminder.notifyAt);
    notifyAt.setHours(hours, minutes, 0, 0);
    await prisma.reminder.update({ where: { id: reminder.id }, data: { notifyAt } });
  }

  revalidatePath("/", "layout");
  redirect("/settings?section=reminders&saved=1");
}

export async function updateTelegramSettings(formData: FormData) {
  await requireAdmin();
  const current = await prisma.appSetting.findUnique({ where: { id: "default" } });
  // An empty token field keeps the stored token, so the secret never has to be sent back to the browser.
  const telegramBotToken = formData.has("clearToken") ? null : text(formData, "telegramBotToken") ?? current?.telegramBotToken ?? null;
  const data = { telegramBotToken, telegramChatId: text(formData, "telegramChatId") ?? null };
  await prisma.appSetting.upsert({ where: { id: "default" }, update: data, create: { ...settingsDefaults, ...data } });
  redirect("/settings?section=telegram&saved=1");
}

export async function testTelegramNotification() {
  await requireAdmin();
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if (!settings?.telegramBotToken || !settings.telegramChatId) redirect("/settings?section=telegram&telegram=missing");

  const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: settings.telegramChatId, text: "✅ Test Garaj: notificările pe Telegram funcționează." })
  }).catch(() => null);

  redirect(`/settings?section=telegram&telegram=${response?.ok ? "ok" : "failed"}`);
}

const validColor = (value: string | undefined) => (value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#6366f1");
const validIcon = (value: string | undefined) => ((CATEGORY_ICONS as readonly string[]).includes(value ?? "") ? value! : "tag");

export async function createCostCategory(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) redirect("/settings?section=categories&error=name");
  const last = await prisma.expenseCategoryConfig.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.expenseCategoryConfig.create({
    data: { key: `custom-${Date.now().toString(36)}`, name, color: validColor(text(formData, "color")), icon: validIcon(text(formData, "icon")), sortOrder: (last?.sortOrder ?? 0) + 1 }
  });
  revalidatePath("/", "layout");
  redirect("/settings?section=categories");
}

export async function updateCostCategory(categoryId: string, formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) redirect("/settings?section=categories&error=name");
  await prisma.expenseCategoryConfig.update({
    where: { id: categoryId },
    data: { name, color: validColor(text(formData, "color")), icon: validIcon(text(formData, "icon")) }
  });
  revalidatePath("/", "layout");
  redirect("/settings?section=categories&saved=1");
}

export async function toggleCostCategory(categoryId: string) {
  await requireAdmin();
  const category = await prisma.expenseCategoryConfig.findUnique({ where: { id: categoryId } });
  if (category) await prisma.expenseCategoryConfig.update({ where: { id: categoryId }, data: { isActive: !category.isActive } });
  revalidatePath("/", "layout");
  redirect("/settings?section=categories");
}

export async function dismissAlert(key: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  const keys = dismissedKeys(settings?.dismissedAlerts);
  keys.add(key);
  await prisma.appSetting.upsert({ where: { id: "default" }, update: { dismissedAlerts: [...keys] }, create: { ...settingsDefaults, dismissedAlerts: [...keys] } });
  revalidatePath("/", "layout");
}

export async function restoreAlerts() {
  await requireAdmin();
  await prisma.appSetting.update({ where: { id: "default" }, data: { dismissedAlerts: [] } });
  revalidatePath("/", "layout");
}

export async function toggleVehicleReminders(vehicleId: string) {
  await requireVehicleAccess(vehicleId);
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { remindersEnabled: true } });
  if (vehicle) await prisma.vehicle.update({ where: { id: vehicleId }, data: { remindersEnabled: !vehicle.remindersEnabled } });
  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=settings`);
}

export type FuelImportRow = {
  date: string;
  quantity: number;
  odometerKm: number | null;
  unitPrice: number | null;
  total: number | null;
  station: string | null;
  socStart: number | null;
  socEnd: number | null;
  durationMin: number | null;
  importKey: string;
};

// Rows are parsed and mapped in the browser; the server only validates and stores them, skipping ones already imported.
export async function importFuelEntries(vehicleId: string, rows: FuelImportRow[]) {
  await requireVehicleAccess(vehicleId);
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { fuelType: true } });
  if (!vehicle) return { imported: 0, skipped: rows.length };
  const key = vehicle.fuelType === "ELECTRIC" ? "charging" : "fuel";
  const config = await prisma.expenseCategoryConfig.findUnique({ where: { key } });
  const existing = new Set((await prisma.expense.findMany({ where: { vehicleId, importKey: { not: null } }, select: { importKey: true } })).map((row) => row.importKey));
  const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

  let imported = 0;
  for (const row of rows.slice(0, 5000)) {
    const date = new Date(row.date);
    const quantity = finite(row.quantity);
    if (Number.isNaN(date.getTime()) || !quantity || quantity <= 0 || !row.importKey || existing.has(row.importKey)) continue;
    const unitPrice = finite(row.unitPrice);
    const total = finite(row.total) ?? (unitPrice ? quantity * unitPrice : 0);
    await prisma.expense.create({
      data: {
        vehicleId,
        category: expenseEnumForKey(key),
        categoryConfigId: config?.id ?? null,
        amount: total.toFixed(2),
        occurredAt: date,
        odometerKm: finite(row.odometerKm) === null ? null : Math.round(row.odometerKm!),
        quantity,
        unitPrice: unitPrice === null ? null : unitPrice.toFixed(3),
        station: typeof row.station === "string" ? row.station.slice(0, 120) : null,
        socStart: finite(row.socStart) === null ? null : Math.round(row.socStart!),
        socEnd: finite(row.socEnd) === null ? null : Math.round(row.socEnd!),
        durationMin: finite(row.durationMin) === null ? null : Math.round(row.durationMin!),
        importKey: String(row.importKey).slice(0, 80)
      }
    });
    existing.add(row.importKey);
    imported++;
  }

  revalidatePath("/");
  return { imported, skipped: rows.length - imported };
}
