export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REMINDER_SCHEDULER === "off") return;

  const { startReminderScheduler } = await import("./lib/reminder-scheduler");
  startReminderScheduler();
}
