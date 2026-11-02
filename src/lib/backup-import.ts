import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { DocumentType, ExpenseCategory, FuelType, PaymentFrequency, PaymentInstallmentStatus, PaymentPlanCategory, PaymentPlanStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rebuildDocumentReminders } from "@/lib/reminders";

function enumValue<T extends Record<string, string>>(values: T, value: string | undefined) {
  return value && Object.values(values).includes(value) ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function arrayValue(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const result: Array<Record<string, unknown>> = [];
  for (const item of value) {
    const object = objectValue(item);
    if (object) result.push(object);
  }
  return result;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanImportValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function decimalImportValue(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function floatImportValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateImportValue(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Imported accounts get an unguessable password; the admin sets a real one from Șoferi.
async function randomPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);
}

export type ImportResult = { vehicles: number };

// Restores a backup (formatVersion 1-5). Vehicles with the same plate number are replaced.
export async function importBackup(payload: unknown, currentUser: { id: string; role: Role }): Promise<ImportResult> {
  const root = objectValue(payload);
  const usersList = arrayValue(root?.users);

  for (const categoryItem of arrayValue(root?.expenseCategories)) {
    const key = stringValue(categoryItem.key);
    const name = stringValue(categoryItem.name);
    if (!key || !name) continue;
    const color = /^#[0-9a-f]{6}$/i.test(stringValue(categoryItem.color) ?? "") ? stringValue(categoryItem.color)! : "#a8a3bd";
    const fields = { name, color, icon: stringValue(categoryItem.icon) ?? "tag", sortOrder: numberValue(categoryItem.sortOrder) ?? 100, isActive: booleanImportValue(categoryItem.isActive) ?? true };
    await prisma.expenseCategoryConfig.upsert({ where: { key }, update: fields, create: { key, ...fields } });
  }
  const categoryIds = new Map((await prisma.expenseCategoryConfig.findMany()).map((category) => [category.key, category.id]));

  for (const userItem of usersList) {
    const email = stringValue(userItem.email)?.toLowerCase();
    const firstName = stringValue(userItem.firstName) ?? "Driver";
    const lastName = stringValue(userItem.lastName) ?? "User";
    const profileImageUrl = stringValue(userItem.profileImageUrl) ?? null;
    const licenseCategory = stringValue(userItem.licenseCategory) ?? null;
    const licenseIssuedAt = dateImportValue(userItem.licenseIssuedAt) ?? null;
    const licenseExpiresAt = dateImportValue(userItem.licenseExpiresAt) ?? null;
    const idCardIssuedAt = dateImportValue(userItem.idCardIssuedAt) ?? null;
    const idCardExpiresAt = dateImportValue(userItem.idCardExpiresAt) ?? null;
    const role = stringValue(userItem.role) === "ADMIN" ? Role.ADMIN : Role.DRIVER;

    if (!email) continue;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: {
          firstName,
          lastName,
          profileImageUrl,
          licenseCategory,
          licenseIssuedAt,
          licenseExpiresAt,
          idCardIssuedAt,
          idCardExpiresAt
        }
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          role,
          profileImageUrl,
          licenseCategory,
          licenseIssuedAt,
          licenseExpiresAt,
          idCardIssuedAt,
          idCardExpiresAt,
          passwordHash: await randomPasswordHash()
        }
      });
    }
  }

  const vehicles = arrayValue(root?.vehicles);

  if (vehicles.length === 0) {
    return { vehicles: 0 };
  }

  for (const item of vehicles) {
    const plateNumber = stringValue(item.plateNumber)?.toUpperCase();
    const make = stringValue(item.make);
    const model = stringValue(item.model);

    if (!plateNumber || !make || !model) continue;

    const driverObj = objectValue(item.driver);
    let driver: any = null;
    if (driverObj) {
      const email = stringValue(driverObj.email)?.toLowerCase();
      const firstName = stringValue(driverObj.firstName) ?? "Driver";
      const lastName = stringValue(driverObj.lastName) ?? "User";
      const profileImageUrl = stringValue(driverObj.profileImageUrl) ?? null;
      const licenseCategory = stringValue(driverObj.licenseCategory) ?? null;
      const licenseIssuedAt = dateImportValue(driverObj.licenseIssuedAt) ?? null;
      const licenseExpiresAt = dateImportValue(driverObj.licenseExpiresAt) ?? null;
      const idCardIssuedAt = dateImportValue(driverObj.idCardIssuedAt) ?? null;
      const idCardExpiresAt = dateImportValue(driverObj.idCardExpiresAt) ?? null;
      const role = stringValue(driverObj.role) === "ADMIN" ? Role.ADMIN : Role.DRIVER;

      if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          driver = await prisma.user.update({
            where: { email },
            data: {
              firstName,
              lastName,
              profileImageUrl,
              licenseCategory,
              licenseIssuedAt,
              licenseExpiresAt,
              idCardIssuedAt,
              idCardExpiresAt
            }
          });
        } else {
          driver = await prisma.user.create({
            data: {
              email,
              firstName,
              lastName,
              role,
              profileImageUrl,
              licenseCategory,
              licenseIssuedAt,
              licenseExpiresAt,
              idCardIssuedAt,
              idCardExpiresAt,
              passwordHash: await randomPasswordHash()
            }
          });
        }
      }
    }
    const fallbackDriverId = currentUser.role === Role.ADMIN ? currentUser.id : null;
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });

    if (existing) {
      await prisma.paymentInstallment.deleteMany({ where: { paymentPlan: { vehicleId: existing.id } } });
      await prisma.paymentPlan.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.reminder.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.vehicleDocument.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.expense.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.serviceRecord.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.tireSet.deleteMany({ where: { vehicleId: existing.id } });
    }

    const vehicle = await prisma.vehicle.upsert({
      where: { plateNumber },
      update: {
        make,
        model,
        vin: stringValue(item.vin) ?? null,
        civSeries: stringValue(item.civSeries) ?? null,
        registrationSeries: stringValue(item.registrationSeries) ?? null,
        engineCapacityCc: numberValue(item.engineCapacityCc) ?? null,
        powerKw: numberValue(item.powerKw) ?? null,
        color: stringValue(item.color) ?? null,
        totalMassKg: numberValue(item.totalMassKg) ?? null,
        fuelType: (stringValue(item.fuelType) as FuelType | undefined) ?? null,
        seats: numberValue(item.seats) ?? null,
        manufacturingYear: numberValue(item.manufacturingYear) ?? null,
        warrantyUntil: dateImportValue(item.warrantyUntil) ?? null,
        acquisitionPrice: decimalImportValue(item.acquisitionPrice),
        notes: stringValue(item.notes) ?? null,
        imageUrl: stringValue(item.imageUrl) ?? null,
        backgroundImageUrl: stringValue(item.backgroundImageUrl) ?? null,
        remindersEnabled: booleanImportValue(item.remindersEnabled) ?? true,
        equipment: stringValue(item.equipment) ?? null,
        batteryCapacityKwh: floatImportValue(item.batteryCapacityKwh) ?? null,
        batteryWarrantyUntil: dateImportValue(item.batteryWarrantyUntil) ?? null,
        batteryWarrantyKm: numberValue(item.batteryWarrantyKm) ?? null,
        driverId: driver?.id ?? fallbackDriverId
      },
      create: {
        id: stringValue(item.id),
        plateNumber,
        make,
        model,
        vin: stringValue(item.vin),
        civSeries: stringValue(item.civSeries),
        registrationSeries: stringValue(item.registrationSeries),
        engineCapacityCc: numberValue(item.engineCapacityCc),
        powerKw: numberValue(item.powerKw),
        color: stringValue(item.color),
        totalMassKg: numberValue(item.totalMassKg),
        fuelType: stringValue(item.fuelType) as FuelType | undefined,
        seats: numberValue(item.seats),
        manufacturingYear: numberValue(item.manufacturingYear),
        warrantyUntil: dateImportValue(item.warrantyUntil),
        acquisitionPrice: decimalImportValue(item.acquisitionPrice),
        notes: stringValue(item.notes),
        imageUrl: stringValue(item.imageUrl),
        backgroundImageUrl: stringValue(item.backgroundImageUrl),
        remindersEnabled: booleanImportValue(item.remindersEnabled) ?? true,
        equipment: stringValue(item.equipment),
        batteryCapacityKwh: floatImportValue(item.batteryCapacityKwh),
        batteryWarrantyUntil: dateImportValue(item.batteryWarrantyUntil),
        batteryWarrantyKm: numberValue(item.batteryWarrantyKm),
        createdById: currentUser.id,
        driverId: driver?.id ?? fallbackDriverId
      }
    });

    for (const doc of arrayValue(item.documents)) {
      const type = stringValue(doc.type) as DocumentType | undefined;
      const validUntil = dateImportValue(doc.validUntil);
      if (!type || !validUntil) continue;

      const document = await prisma.vehicleDocument.create({
        data: {
          id: stringValue(doc.id),
          vehicleId: vehicle.id,
          type,
          issuedAt: dateImportValue(doc.issuedAt),
          validityMonths: numberValue(doc.validityMonths),
          paymentFrequency: stringValue(doc.paymentFrequency) as PaymentFrequency | undefined,
          validUntil,
          cost: decimalImportValue(doc.cost),
          reminderDays: Array.isArray(doc.reminderDays) ? doc.reminderDays.map(Number).filter(Number.isFinite) : [30, 7, 3, 1],
          notes: stringValue(doc.notes)
        }
      });
      await rebuildDocumentReminders(document.id);
    }

    for (const expense of arrayValue(item.expenses)) {
      const category = stringValue(expense.category) as ExpenseCategory | undefined;
      const amount = decimalImportValue(expense.amount);
      const occurredAt = dateImportValue(expense.occurredAt);
      if (!category || !amount || !occurredAt) continue;

      await prisma.expense.create({
        data: {
          id: stringValue(expense.id),
          vehicleId: vehicle.id,
          category,
          amount,
          occurredAt,
          odometerKm: numberValue(expense.odometerKm),
          notes: stringValue(expense.notes),
          categoryConfigId: categoryIds.get(stringValue(expense.categoryKey) ?? "") ?? null,
          quantity: floatImportValue(expense.quantity),
          unitPrice: decimalImportValue(expense.unitPrice),
          socStart: numberValue(expense.socStart),
          socEnd: numberValue(expense.socEnd),
          durationMin: numberValue(expense.durationMin),
          station: stringValue(expense.station),
          importKey: stringValue(expense.importKey)
        }
      });
    }

    for (const service of arrayValue(item.services)) {
      const servicedAt = dateImportValue(service.servicedAt);
      const cost = decimalImportValue(service.cost);
      if (!servicedAt || !cost) continue;

      await prisma.serviceRecord.create({
        data: {
          id: stringValue(service.id),
          vehicleId: vehicle.id,
          servicedAt,
          odometerKm: numberValue(service.odometerKm),
          nextServiceAtKm: numberValue(service.nextServiceAtKm),
          cost,
          notes: stringValue(service.notes)
        }
      });
    }

    for (const tire of arrayValue(item.tires)) {
      const type = stringValue(tire.type) as "SUMMER" | "WINTER" | "ALL_SEASON" | undefined;
      const brand = stringValue(tire.brand);
      const size = stringValue(tire.size);
      const purchasedAt = dateImportValue(tire.purchasedAt);
      if (!type || !brand || !size || !purchasedAt) continue;

      await prisma.tireSet.create({
        data: {
          id: stringValue(tire.id),
          vehicleId: vehicle.id,
          type,
          brand,
          model: stringValue(tire.model),
          size,
          cost: decimalImportValue(tire.cost),
          purchasedAt,
          notes: stringValue(tire.notes)
        }
      });
    }

    for (const planItem of arrayValue(item.paymentPlans)) {
      const category = enumValue(PaymentPlanCategory, stringValue(planItem.category)) as PaymentPlanCategory | undefined;
      const frequency = enumValue(PaymentFrequency, stringValue(planItem.frequency)) as PaymentFrequency | undefined;
      const name = stringValue(planItem.name);
      const totalAmount = decimalImportValue(planItem.totalAmount);
      const installmentAmount = decimalImportValue(planItem.installmentAmount);
      const totalInstallments = numberValue(planItem.totalInstallments);
      const firstPaymentDate = dateImportValue(planItem.firstPaymentDate);
      if (!category || !frequency || !name || !totalAmount || !installmentAmount || !totalInstallments || !firstPaymentDate) continue;

      const plan = await prisma.paymentPlan.create({
        data: {
          vehicleId: vehicle.id,
          name,
          category,
          totalAmount,
          installmentAmount,
          totalInstallments,
          frequency,
          firstPaymentDate,
          status: (enumValue(PaymentPlanStatus, stringValue(planItem.status)) as PaymentPlanStatus | undefined) ?? PaymentPlanStatus.ACTIVE,
          currency: stringValue(planItem.currency) ?? "RON",
          reminderDays: numberValue(planItem.reminderDays) ?? 7,
          notes: stringValue(planItem.notes)
        }
      });
      for (const installment of arrayValue(planItem.installments)) {
        const installmentNumber = numberValue(installment.installmentNumber);
        const dueDate = dateImportValue(installment.dueDate);
        const amount = decimalImportValue(installment.amount);
        if (!installmentNumber || !dueDate || !amount) continue;
        await prisma.paymentInstallment.create({
          data: {
            paymentPlanId: plan.id,
            installmentNumber,
            dueDate,
            amount,
            currency: stringValue(installment.currency) ?? "RON",
            status: (enumValue(PaymentInstallmentStatus, stringValue(installment.status)) as PaymentInstallmentStatus | undefined) ?? PaymentInstallmentStatus.UNPAID,
            paidDate: dateImportValue(installment.paidDate) ?? null,
            notes: stringValue(installment.notes)
          }
        });
      }
    }
  }

  return { vehicles: vehicles.length };
}
