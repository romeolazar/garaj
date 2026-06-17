import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { documentLabels } from "@/lib/labels";

export async function rebuildDocumentReminders(documentId: string) {
  const document = await prisma.vehicleDocument.findUnique({
    where: { id: documentId },
    include: { vehicle: true }
  });

  if (!document) return;

  await prisma.reminder.deleteMany({ where: { documentId } });

  await prisma.reminder.createMany({
    data: document.reminderDays.map((days) => ({
      vehicleId: document.vehicleId,
      documentId,
      title: `${documentLabels[document.type]} expira pentru ${document.vehicle.plateNumber}`,
      dueAt: document.validUntil,
      notifyAt: addDays(document.validUntil, -days)
    }))
  });
}
