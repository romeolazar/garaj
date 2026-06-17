import { prisma } from "@/lib/prisma";

async function run() {
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", notifyAt: { lte: new Date() } },
    include: { vehicle: true },
    orderBy: { notifyAt: "asc" }
  });

  for (const reminder of due) {
    console.log(`[reminder] ${reminder.title} (${reminder.vehicle.plateNumber}) due ${reminder.dueAt.toISOString()}`);
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
