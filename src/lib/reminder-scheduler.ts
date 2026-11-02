import { deliverDueReminders } from "./reminder-delivery";

const globalForScheduler = globalThis as unknown as { reminderScheduler?: NodeJS.Timeout };

export function startReminderScheduler() {
  if (globalForScheduler.reminderScheduler) return;

  const pollSeconds = Math.max(Number.parseInt(process.env.REMINDER_POLL_SECONDS ?? "300", 10) || 300, 30);
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverDueReminders();
    } catch (error) {
      console.error("[reminders] Scheduled run failed:", error);
    } finally {
      running = false;
    }
  };

  globalForScheduler.reminderScheduler = setInterval(tick, pollSeconds * 1000);
  setTimeout(tick, 10_000);
  console.log(`[reminders] Scheduler started, polling every ${pollSeconds}s.`);
}
