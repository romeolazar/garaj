import { PrismaClient, DocumentType, FuelType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addMonths } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!seedAdminPassword) {
    console.log("Skipping demo seed data. Set SEED_ADMIN_PASSWORD to create a demo admin and vehicle.");
    return;
  }

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const admin = await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {},
    create: {
      email: seedAdminEmail,
      passwordHash: await bcrypt.hash(seedAdminPassword, 10),
      firstName: "Admin",
      lastName: "Garaj",
      role: Role.ADMIN
    }
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: "DEMO-001" },
    update: {},
    create: {
      plateNumber: "DEMO-001",
      make: "Example Motors",
      model: "Atlas",
      vin: "DEMO0000000000001",
      civSeries: "CIV-DEMO-001",
      registrationSeries: "CERT-DEMO-001",
      engineCapacityCc: 1498,
      powerKw: 110,
      color: "Albastru",
      totalMassKg: 1850,
      fuelType: FuelType.PETROL,
      seats: 5,
      manufacturingYear: 2024,
      acquisitionPrice: "25000",
      notes: "Vehicul demo pentru verificarea dashboard-ului.",
      createdById: admin.id,
      driverId: admin.id
    }
  });

  const docs = [
    [DocumentType.ITP, addMonths(new Date(), 14)],
    [DocumentType.RCA, addDays(new Date(), 27)],
    [DocumentType.ROVINIETA, addDays(new Date(), 72)],
    [DocumentType.FIRE_EXTINGUISHER, addDays(new Date(), 9)]
  ] as const;

  for (const [type, validUntil] of docs) {
    const existing = await prisma.vehicleDocument.findFirst({
      where: { vehicleId: vehicle.id, type }
    });
    const document = existing
      ? await prisma.vehicleDocument.update({ where: { id: existing.id }, data: { validUntil } })
      : await prisma.vehicleDocument.create({ data: { vehicleId: vehicle.id, type, validUntil, reminderDays: [30, 7, 3, 1] } });

    for (const days of document.reminderDays) {
      await prisma.reminder.upsert({
        where: { id: `${document.id}-${days}` },
        update: {},
        create: {
          id: `${document.id}-${days}`,
          vehicleId: vehicle.id,
          documentId: document.id,
          title: `${type} expira pentru ${vehicle.plateNumber}`,
          dueAt: validUntil,
          notifyAt: addDays(validUntil, -days)
        }
      });
    }
  }

  await prisma.expense.createMany({
    data: [
      {
        vehicleId: vehicle.id,
        category: "SERVICE",
        amount: "750",
        occurredAt: addMonths(new Date(), -2),
        odometerKm: 12000,
        notes: "Exemplu revizie"
      },
      {
        vehicleId: vehicle.id,
        category: "FUEL",
        amount: "300",
        occurredAt: addDays(new Date(), -8),
        odometerKm: 12850,
        notes: "Exemplu alimentare"
      }
    ],
    skipDuplicates: true
  });

}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
