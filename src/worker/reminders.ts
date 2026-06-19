import { prisma } from "../lib/prisma";
import nodemailer from "nodemailer";

async function run() {
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", notifyAt: { lte: new Date() } },
    include: {
      vehicle: {
        include: {
          driver: true,
          createdBy: true
        }
      }
    },
    orderBy: { notifyAt: "asc" }
  });

  if (due.length === 0) {
    console.log("[reminders] No pending reminders due.");
    return;
  }

  console.log(`[reminders] Found ${due.length} pending reminders due.`);

  // Setup email transporter if credentials exist
  let transporter: any = null;
  if (settings?.smtpUser && settings?.smtpPassword) {
    transporter = nodemailer.createTransport({
      host: settings.smtpHost || "smtp.gmail.com",
      port: settings.smtpPort || 465,
      secure: true,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword
      }
    });
    console.log("[reminders] Email SMTP transporter configured.");
  } else {
    console.log("[reminders] Email SMTP not configured.");
  }

  const telegramEnabled = !!(settings?.telegramBotToken && settings?.telegramChatId);
  if (telegramEnabled) {
    console.log("[reminders] Telegram notifications enabled.");
  } else {
    console.log("[reminders] Telegram notifications not configured.");
  }

  for (const reminder of due) {
    let emailSent = false;
    let telegramSent = false;

    // 1. Send Email
    if (transporter) {
      const recipientEmails = new Set<string>();
      if (reminder.vehicle.driver?.email) {
        recipientEmails.add(reminder.vehicle.driver.email);
      }
      if (reminder.vehicle.createdBy.email) {
        recipientEmails.add(reminder.vehicle.createdBy.email);
      }

      if (recipientEmails.size > 0) {
        try {
          const emails = Array.from(recipientEmails);
          await transporter.sendMail({
            from: settings?.smtpFrom || settings?.smtpUser,
            to: emails.join(", "),
            subject: `Alertă Garaj: ${reminder.title}`,
            text: `Mesaj de la aplicația Garaj:\n\n${reminder.title}\nVehicul: ${reminder.vehicle.plateNumber} (${reminder.vehicle.make} ${reminder.vehicle.model})\nDată scadență: ${reminder.dueAt.toLocaleDateString("ro-RO")}\n\nTe rugăm să verifici detaliile în aplicație.`
          });
          console.log(`[reminders] Email sent for reminder "${reminder.title}" to ${emails.join(", ")}`);
          emailSent = true;
        } catch (error) {
          console.error(`[reminders] Failed to send email for reminder "${reminder.title}":`, error);
        }
      }
    }

    // 2. Send Telegram
    if (telegramEnabled && settings) {
      try {
        const messageText = `⚠️ *Alertă Garaj*\n\n*${reminder.title}*\n🚗 Vehicul: \`${reminder.vehicle.plateNumber}\` (${reminder.vehicle.make} ${reminder.vehicle.model})\n📅 Scadență: ${reminder.dueAt.toLocaleDateString("ro-RO")}`;
        const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: messageText,
            parse_mode: "Markdown"
          })
        });
        if (response.ok) {
          console.log(`[reminders] Telegram message sent for reminder "${reminder.title}"`);
          telegramSent = true;
        } else {
          const errText = await response.text();
          console.error(`[reminders] Telegram response error for reminder "${reminder.title}":`, errText);
        }
      } catch (error) {
        console.error(`[reminders] Failed to send Telegram notification for "${reminder.title}":`, error);
      }
    }

    // 3. Update status to SENT if either succeeded, or if neither is configured (to avoid looping on empty configs)
    const shouldMarkSent = emailSent || telegramSent || (!transporter && !telegramEnabled);
    if (shouldMarkSent) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "SENT" }
      });
      console.log(`[reminders] Reminder "${reminder.title}" marked as SENT.`);
    }
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
