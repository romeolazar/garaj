import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { documentLabels } from "@/lib/labels";
import { Prisma } from "@prisma/client";

const DEFAULT_REMINDER_DAYS = [30, 7, 3, 1];

// SQLite has no scalar lists, so reminderDays is stored as a JSON array.
export function reminderDaysValue(value: Prisma.JsonValue): number[] {
  if (!Array.isArray(value)) return DEFAULT_REMINDER_DAYS;
  return value.map(Number).filter(Number.isFinite);
}

// Reminders go out at the configured time of day, `days` before the deadline.
export function reminderTime(date: Date, days: number, notificationTime: string) {
  const notifyAt = addDays(date, -days);
  const match = notificationTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  notifyAt.setHours(match ? Number(match[1]) : 9, match ? Number(match[2]) : 0, 0, 0);
  return notifyAt;
}

export async function rebuildDocumentReminders(documentId: string) {
  const document = await prisma.vehicleDocument.findUnique({
    where: { id: documentId },
    include: { vehicle: true }
  });

  if (!document) return;

  const settings = await prisma.appSetting.findUnique({ where: { id: "default" }, select: { notificationTime: true } });
  await prisma.reminder.deleteMany({ where: { documentId } });

  await prisma.reminder.createMany({
    data: reminderDaysValue(document.reminderDays).map((days) => ({
      vehicleId: document.vehicleId,
      documentId,
      title: `${documentLabels[document.type]} expira pentru ${document.vehicle.plateNumber}`,
      dueAt: document.validUntil,
      notifyAt: reminderTime(document.validUntil, days, settings?.notificationTime ?? "09:00")
    }))
  });
}
