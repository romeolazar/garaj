import { prisma } from "./prisma";
import { odometerReminderForVehicle } from "./odometer-reminders";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendTelegram(token: string, chatId: string, html: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" })
  });
  if (!response.ok) console.error("[reminders] Telegram error:", await response.text());
  return response.ok;
}

export async function deliverDueReminders() {
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if (settings?.notificationsEnabled === false) {
    console.log("[reminders] Notifications are disabled; in-app alerts are kept.");
    return;
  }
  const token = settings?.telegramBotToken;
  const chatId = settings?.telegramChatId;
  if (!token || !chatId) {
    console.log("[reminders] Telegram not configured; reminders stay pending.");
    return;
  }

  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", notifyAt: { lte: new Date() }, vehicle: { remindersEnabled: true } },
    include: { vehicle: true },
    orderBy: { notifyAt: "asc" }
  });
  console.log(`[reminders] ${due.length} reminders due.`);

  for (const reminder of due) {
    const v = reminder.vehicle;
    const text = `⚠️ <b>Alertă Garaj</b>\n\n<b>${escapeHtml(reminder.title)}</b>\n🚗 ${escapeHtml(`${v.make} ${v.model} · ${v.plateNumber}`)}\n📅 Scadență: ${reminder.dueAt.toLocaleDateString("ro-RO")}`;
    try {
      if (await sendTelegram(token, chatId, text)) {
        await prisma.reminder.update({ where: { id: reminder.id }, data: { status: "SENT" } });
      }
    } catch (error) {
      console.error(`[reminders] Failed to send "${reminder.title}":`, error);
    }
  }

  // Service due by odometer: notify once per service record when the threshold is reached.
  const vehicles = await prisma.vehicle.findMany({
    where: { remindersEnabled: true, services: { some: { nextServiceAtKm: { not: null }, odometerNotifiedAt: null } } },
    include: { expenses: { select: { odometerKm: true } }, services: true }
  });
  for (const vehicle of vehicles) {
    const alert = odometerReminderForVehicle(vehicle, settings?.odometerReminderKm ?? 500);
    if (!alert || alert.service.odometerNotifiedAt) continue;
    const remaining = alert.isOverdue ? `${Math.abs(alert.remainingKm).toLocaleString("ro-RO")} km peste termen` : `${alert.remainingKm.toLocaleString("ro-RO")} km rămași`;
    const text = `🔧 <b>Revizie la ${alert.targetOdometer.toLocaleString("ro-RO")} km</b>\n🚗 ${escapeHtml(`${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`)}\n📍 Kilometraj curent: ${alert.currentOdometer.toLocaleString("ro-RO")} km · ${remaining}`;
    try {
      if (await sendTelegram(token, chatId, text)) {
        await prisma.serviceRecord.update({ where: { id: alert.service.id }, data: { odometerNotifiedAt: new Date() } });
      }
    } catch (error) {
      console.error(`[reminders] Failed to send odometer alert for ${vehicle.plateNumber}:`, error);
    }
  }
}
