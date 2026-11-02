import { prisma } from "../lib/prisma";
import { deliverDueReminders } from "../lib/reminder-delivery";

// One-off run for debugging; the server runs this on a schedule (see src/instrumentation.ts).
deliverDueReminders()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
