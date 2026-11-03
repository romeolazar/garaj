"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import JSZip from "jszip";
import { addMonths } from "date-fns";
import { DocumentType, ExpenseCategory, FuelType, PaymentFrequency, PaymentInstallmentStatus, PaymentPlanCategory, PaymentPlanStatus, Role, TireType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rebuildDocumentReminders } from "@/lib/reminders";
import { paymentTypes } from "@/lib/labels";
import { expenseEnumForKey } from "@/lib/cost-categories";
import { importBackup } from "@/lib/backup-import";
import { removeStoredFile } from "@/lib/storage";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function intValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? Number.parseInt(value, 10) : undefined;
}

function decimalValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return undefined;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : undefined;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(`${value}T12:00:00`) : undefined;
}

function roDateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return undefined;

  const isoDate = dateValue(formData, key);
  if (isoDate && !Number.isNaN(isoDate.getTime())) return isoDate;

  const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return undefined;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const rawYear = Number.parseInt(match[3], 10);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day, 12, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }

  return date;
}

function floatValue(formData: FormData, key: string) {
  const value = decimalValue(formData, key);
  return value ? Number(value) : undefined;
}

function nullableText(formData: FormData, key: string) {
  return text(formData, key) ?? null;
}

function nullableInt(formData: FormData, key: string) {
  return intValue(formData, key) ?? null;
}

function nullableDecimal(formData: FormData, key: string) {
  return decimalValue(formData, key) ?? null;
}

function nullableDate(formData: FormData, key: string) {
  return dateValue(formData, key) ?? null;
}

function paymentFrequencyValue(formData: FormData) {
  const value = text(formData, "paymentFrequency") as PaymentFrequency | undefined;
  return value && Object.values(PaymentFrequency).includes(value) ? value : undefined;
}

function paymentIntervalMonths(frequency: PaymentFrequency | undefined) {
  switch (frequency) {
    case PaymentFrequency.QUARTERLY:
      return 3;
    case PaymentFrequency.SEMIANNUAL:
      return 6;
    case PaymentFrequency.ANNUAL:
      return 12;
    default:
      return 1;
  }
}

function calculatedValidUntil(issuedAt: Date | undefined, installments: number | undefined, frequency: PaymentFrequency | undefined) {
  if (!issuedAt || !installments) return undefined;
  return addMonths(issuedAt, Math.max(installments - 1, 0) * paymentIntervalMonths(frequency));
}

function enumValue<T extends Record<string, string>>(values: T, value: string | undefined) {
  return value && Object.values(values).includes(value) ? value : undefined;
}

function moneyString(value: number) {
  return value.toFixed(2);
}

function installmentRows({
  planId,
  totalInstallments,
  installmentAmount,
  firstPaymentDate,
  frequency,
  currency,
  existing = []
}: {
  planId: string;
  totalInstallments: number;
  installmentAmount: string;
  firstPaymentDate: Date;
  frequency: PaymentFrequency;
  currency: string;
  existing?: Array<{ installmentNumber: number; status: PaymentInstallmentStatus; paidDate: Date | null; notes: string | null; amount: unknown }>;
}) {
  const interval = paymentIntervalMonths(frequency);

  return Array.from({ length: totalInstallments }, (_, index) => {
    const installmentNumber = index + 1;
    const previous = existing.find((item) => item.installmentNumber === installmentNumber);

    return {
      paymentPlanId: planId,
      installmentNumber,
      dueDate: addMonths(firstPaymentDate, index * interval),
      amount: previous?.amount?.toString() ?? installmentAmount,
      currency,
      status: previous?.status ?? PaymentInstallmentStatus.UNPAID,
      paidDate: previous?.paidDate ?? null,
      notes: previous?.notes ?? null
    };
  });
}

async function syncPaymentPlanStatus(planId: string) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { installments: true }
  });
  if (!plan || plan.status === PaymentPlanStatus.CANCELLED) return;

  const payable = plan.installments.filter((item) => item.status !== PaymentInstallmentStatus.CANCELLED);
  const completed = payable.length > 0 && payable.every((item) => item.status === PaymentInstallmentStatus.PAID);

  await prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: completed ? PaymentPlanStatus.COMPLETED : PaymentPlanStatus.ACTIVE }
  });
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session;
}

// Accepts the .zip archive (garaj.json inside) or a plain .json / .grj backup.
async function readBackupFile(file: File): Promise<unknown> {
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file("garaj.json");
    if (!entry) throw new Error("garaj.json missing");
    return JSON.parse(await entry.async("string"));
  }
  return JSON.parse(await file.text());
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}

async function resolveSessionUser(session: Awaited<ReturnType<typeof requireSession>>) {
  const userById = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (userById) return userById;

  const email = session.user.email?.toLowerCase().trim();
  if (email) {
    const userByEmail = await prisma.user.findUnique({ where: { email } });
    if (userByEmail) return userByEmail;
  }

  redirect("/login");
}

async function requireVehicleAccess(vehicleId: string) {
  const session = await requireSession();
  if (session.user.role === "ADMIN") return session;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { driverId: true }
  });

  if (!vehicle || vehicle.driverId !== session.user.id) {
    redirect("/");
  }

  return session;
}

export async function createInitialAdmin(formData: FormData) {
  const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (admins > 0) redirect("/login");

  const email = text(formData, "email")?.toLowerCase();
  const password = text(formData, "password");
  const firstName = text(formData, "firstName") ?? "Admin";
  const lastName = text(formData, "lastName") ?? "Garaj";

  if (!email || !password || password.length < 8) {
    redirect("/setup?error=invalid");
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      role: Role.ADMIN
    }
  });

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  redirect("/login?created=1");
}

export async function createVehicle(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/");

  const plateNumber = text(formData, "plateNumber")?.toUpperCase();
  const make = text(formData, "make");
  const model = text(formData, "model");

  if (!plateNumber || !make || !model) {
    redirect("/vehicles/new?error=required");
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      plateNumber,
      make,
      model,
      vin: text(formData, "vin"),
      civSeries: text(formData, "civSeries"),
      registrationSeries: text(formData, "registrationSeries"),
      engineCapacityCc: intValue(formData, "engineCapacityCc"),
      powerKw: intValue(formData, "powerKw"),
      color: text(formData, "color"),
      totalMassKg: intValue(formData, "totalMassKg"),
      fuelType: text(formData, "fuelType") as FuelType | undefined,
      seats: intValue(formData, "seats"),
      manufacturingYear: intValue(formData, "manufacturingYear"),
      warrantyUntil: dateValue(formData, "warrantyUntil"),
      acquisitionPrice: decimalValue(formData, "acquisitionPrice"),
      notes: text(formData, "notes"),
      imageUrl: text(formData, "imageUrl"),
      backgroundImageUrl: text(formData, "backgroundImageUrl"),
      remindersEnabled: formData.has("remindersEnabled"),
      equipment: text(formData, "equipment"),
      batteryCapacityKwh: floatValue(formData, "batteryCapacityKwh"),
      batteryWarrantyUntil: dateValue(formData, "batteryWarrantyUntil"),
      batteryWarrantyKm: intValue(formData, "batteryWarrantyKm"),
      createdById: session.user.id,
      driverId: text(formData, "driverId")
    }
  });

  const documentMap: Array<[DocumentType, string, string]> = [
    [DocumentType.ITP, "itpUntil", "itpCost"],
    [DocumentType.RCA, "rcaUntil", "rcaCost"],
    [DocumentType.CASCO, "cascoUntil", "cascoCost"],
    [DocumentType.ROVINIETA, "rovinietaUntil", "rovinietaCost"],
    [DocumentType.FIRST_AID_KIT, "firstAidKitUntil", "firstAidKitCost"],
    [DocumentType.FIRE_EXTINGUISHER, "fireExtinguisherUntil", "fireExtinguisherCost"]
  ];

  for (const [type, field, costField] of documentMap) {
    const validUntil = dateValue(formData, field);
    if (!validUntil) continue;

    const document = await prisma.vehicleDocument.create({
      data: { vehicleId: vehicle.id, type, validUntil, cost: decimalValue(formData, costField), reminderDays: [30, 7, 3, 1] }
    });
    await rebuildDocumentReminders(document.id);
  }

  revalidatePath("/");
  redirect(`/?car=${vehicle.id}&tab=general`);
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const session = await requireVehicleAccess(vehicleId);

  const plateNumber = text(formData, "plateNumber")?.toUpperCase();
  const make = text(formData, "make");
  const model = text(formData, "model");

  if (!plateNumber || !make || !model) {
    redirect(`/vehicles/${vehicleId}/edit?error=required`);
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      plateNumber,
      make,
      model,
      vin: nullableText(formData, "vin"),
      civSeries: nullableText(formData, "civSeries"),
      registrationSeries: nullableText(formData, "registrationSeries"),
      engineCapacityCc: nullableInt(formData, "engineCapacityCc"),
      powerKw: nullableInt(formData, "powerKw"),
      color: nullableText(formData, "color"),
      totalMassKg: nullableInt(formData, "totalMassKg"),
      fuelType: (text(formData, "fuelType") as FuelType | undefined) ?? null,
      seats: nullableInt(formData, "seats"),
      manufacturingYear: nullableInt(formData, "manufacturingYear"),
      warrantyUntil: nullableDate(formData, "warrantyUntil"),
      acquisitionPrice: nullableDecimal(formData, "acquisitionPrice"),
      notes: nullableText(formData, "notes"),
      imageUrl: nullableText(formData, "imageUrl"),
      backgroundImageUrl: nullableText(formData, "backgroundImageUrl"),
      remindersEnabled: formData.has("remindersEnabled"),
      equipment: nullableText(formData, "equipment"),
      batteryCapacityKwh: floatValue(formData, "batteryCapacityKwh") ?? null,
      batteryWarrantyUntil: nullableDate(formData, "batteryWarrantyUntil"),
      batteryWarrantyKm: nullableInt(formData, "batteryWarrantyKm"),
      ...(session.user.role === "ADMIN" ? { driverId: nullableText(formData, "driverId") } : {})
    }
  });

  revalidatePath("/");
    revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=general`);
}

export async function addVehicleDocument(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const type = text(formData, "type") as DocumentType | undefined;
  const issuedAt = roDateValue(formData, "issuedAt");
  const validityMonths = intValue(formData, "validityMonths");
  const paymentFrequency = paymentFrequencyValue(formData);
  const validUntil = paymentTypes.includes(type as DocumentType)
    ? calculatedValidUntil(issuedAt, validityMonths, paymentFrequency)
    : issuedAt && validityMonths ? addMonths(issuedAt, validityMonths) : dateValue(formData, "validUntil");

  if (!type || !validUntil) redirect(`/?car=${vehicleId}&tab=registry&error=document`);

  const document = await prisma.vehicleDocument.create({
    data: {
      vehicleId,
      type,
      issuedAt,
      validityMonths,
      paymentFrequency,
      validUntil,
      cost: decimalValue(formData, "cost"),
      reminderDays: [30],
      notes: text(formData, "notes")
    }
  });

  await rebuildDocumentReminders(document.id);
  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=registry`);
}

export async function updateVehicleDocument(documentId: string, formData: FormData) {
  const current = await prisma.vehicleDocument.findUnique({ where: { id: documentId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const type = text(formData, "type") as DocumentType | undefined;
  const issuedAt = roDateValue(formData, "issuedAt");
  const validityMonths = intValue(formData, "validityMonths");
  const paymentFrequency = paymentFrequencyValue(formData);
  const validUntil = paymentTypes.includes(type as DocumentType)
    ? calculatedValidUntil(issuedAt, validityMonths, paymentFrequency)
    : issuedAt && validityMonths ? addMonths(issuedAt, validityMonths) : dateValue(formData, "validUntil");

  if (!type || !validUntil) redirect(`/?car=${current.vehicleId}&tab=registry&error=document`);

  const document = await prisma.vehicleDocument.update({
    where: { id: documentId },
    data: {
      type,
      issuedAt,
      validityMonths,
      paymentFrequency,
      validUntil,
      cost: decimalValue(formData, "cost"),
      notes: text(formData, "notes")
    }
  });

  await rebuildDocumentReminders(document.id);
  revalidatePath("/");
  redirect(`/?car=${document.vehicleId}&tab=registry`);
}

export async function deleteVehicleDocument(documentId: string) {
  const document = await prisma.vehicleDocument.findUnique({ where: { id: documentId } });
  if (!document) redirect("/");
  await requireVehicleAccess(document.vehicleId);

  await prisma.vehicleDocument.delete({ where: { id: documentId } });
  revalidatePath("/");
  redirect(`/?car=${document.vehicleId}&tab=registry`);
}

// Fields shared by expense create/update. The category comes as a cost-category key; fuel rows add quantity and price.
async function expenseData(formData: FormData) {
  const key = text(formData, "costCategory") ?? "other";
  const config = await prisma.expenseCategoryConfig.findUnique({ where: { key } });
  const quantity = floatValue(formData, "quantity");
  const unitPrice = decimalValue(formData, "unitPrice");
  const amount = decimalValue(formData, "amount") ?? (quantity && unitPrice ? moneyString(quantity * Number(unitPrice)) : undefined);
  return {
    key,
    amount,
    occurredAt: dateValue(formData, "occurredAt"),
    data: {
      category: expenseEnumForKey(key),
      categoryConfigId: config?.id ?? null,
      odometerKm: nullableInt(formData, "odometerKm"),
      quantity: quantity ?? null,
      unitPrice: unitPrice ?? null,
      station: nullableText(formData, "station"),
      notes: nullableText(formData, "notes")
    }
  };
}

function returnTab(formData: FormData, fallback: string) {
  const tab = text(formData, "returnTab");
  return tab && /^[a-z]+$/.test(tab) ? tab : fallback;
}

export async function addExpense(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);
  const tab = returnTab(formData, "costs");
  const { key, amount, occurredAt, data } = await expenseData(formData);
  if (!amount || !occurredAt) redirect(`/?car=${vehicleId}&tab=${tab}&error=expense`);

  // A cost in the "Revizii & service" category is a service record, so it also feeds the odometer reminders.
  if (key === "service") {
    await prisma.serviceRecord.create({
      data: { vehicleId, servicedAt: occurredAt, odometerKm: data.odometerKm, nextServiceAtKm: nullableInt(formData, "nextServiceAtKm"), cost: amount, notes: data.notes }
    });
  } else {
    await prisma.expense.create({ data: { vehicleId, amount, occurredAt, ...data } });
  }

  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=${tab}`);
}

// Used by forms that let the user pick the car (e.g. "Adaugă cost" with all cars selected).
export async function addCostForVehicle(formData: FormData) {
  const vehicleId = text(formData, "vehicleId");
  if (!vehicleId) redirect("/");
  await addExpense(vehicleId, formData);
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const current = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);
  const tab = returnTab(formData, "costs");
  const { amount, occurredAt, data } = await expenseData(formData);
  if (!amount || !occurredAt) redirect(`/?car=${current.vehicleId}&tab=${tab}&error=expense`);

  await prisma.expense.update({ where: { id: expenseId }, data: { amount, occurredAt, ...data } });

  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=${tab}`);
}

export async function deleteExpense(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) redirect("/");
  await requireVehicleAccess(expense.vehicleId);

  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath("/");
  revalidatePath("/");
  redirect(`/?car=${expense.vehicleId}&tab=costs`);
}

export async function createPaymentPlan(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const category = enumValue(PaymentPlanCategory, text(formData, "category")) as PaymentPlanCategory | undefined;
  const frequency = enumValue(PaymentFrequency, text(formData, "frequency")) as PaymentFrequency | undefined;
  const name = text(formData, "name");
  const totalAmount = decimalValue(formData, "totalAmount");
  const totalInstallments = intValue(formData, "totalInstallments");
  const firstPaymentDate = dateValue(formData, "firstPaymentDate");
  const currency = text(formData, "currency") ?? "RON";
  const reminderDays = intValue(formData, "reminderDays") ?? 7;

  if (!category || !frequency || !name || !totalAmount || !totalInstallments || !firstPaymentDate) {
    redirect(`/?car=${vehicleId}&tab=costs&error=payment-plan`);
  }

  const providedInstallment = decimalValue(formData, "installmentAmount");
  const installmentAmount = providedInstallment ?? moneyString(Number(totalAmount) / totalInstallments);

  const plan = await prisma.paymentPlan.create({
    data: {
      vehicleId,
      name,
      category,
      totalAmount,
      installmentAmount,
      totalInstallments,
      frequency,
      firstPaymentDate,
      currency,
      reminderDays,
      notes: text(formData, "notes")
    }
  });

  await prisma.paymentInstallment.createMany({
    data: installmentRows({
      planId: plan.id,
      totalInstallments,
      installmentAmount,
      firstPaymentDate,
      frequency,
      currency
    })
  });

  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=costs`);
}

export async function updatePaymentPlan(planId: string, formData: FormData) {
  const current = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { installments: true }
  });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const category = enumValue(PaymentPlanCategory, text(formData, "category")) as PaymentPlanCategory | undefined;
  const frequency = enumValue(PaymentFrequency, text(formData, "frequency")) as PaymentFrequency | undefined;
  const status = enumValue(PaymentPlanStatus, text(formData, "status")) as PaymentPlanStatus | undefined;
  const name = text(formData, "name");
  const totalAmount = decimalValue(formData, "totalAmount");
  const totalInstallments = intValue(formData, "totalInstallments");
  const firstPaymentDate = dateValue(formData, "firstPaymentDate");
  const currency = text(formData, "currency") ?? "RON";
  const reminderDays = intValue(formData, "reminderDays") ?? 7;

  if (!category || !frequency || !status || !name || !totalAmount || !totalInstallments || !firstPaymentDate) {
    redirect(`/?car=${current.vehicleId}&tab=costs&error=payment-plan`);
  }

  const providedInstallment = decimalValue(formData, "installmentAmount");
  const installmentAmount = providedInstallment ?? moneyString(Number(totalAmount) / totalInstallments);

  await prisma.$transaction(async (tx) => {
    await tx.paymentPlan.update({
      where: { id: planId },
      data: {
        name,
        category,
        totalAmount,
        installmentAmount,
        totalInstallments,
        frequency,
        firstPaymentDate,
        status,
        currency,
        reminderDays,
        notes: text(formData, "notes")
      }
    });
    await tx.paymentInstallment.deleteMany({ where: { paymentPlanId: planId } });
    await tx.paymentInstallment.createMany({
      data: installmentRows({
        planId,
        totalInstallments,
        installmentAmount,
        firstPaymentDate,
        frequency,
        currency,
        existing: current.installments
      })
    });
  });

  await syncPaymentPlanStatus(planId);
  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=costs`);
}

export async function deletePaymentPlan(planId: string) {
  const plan = await prisma.paymentPlan.findUnique({ where: { id: planId } });
  if (!plan) redirect("/");
  await requireVehicleAccess(plan.vehicleId);

  await prisma.paymentPlan.delete({ where: { id: planId } });
  revalidatePath("/");
  redirect(`/?car=${plan.vehicleId}&tab=costs`);
}

export async function markInstallmentPaid(installmentId: string) {
  const current = await prisma.paymentInstallment.findUnique({ where: { id: installmentId }, include: { paymentPlan: true } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.paymentPlan.vehicleId);

  const installment = await prisma.paymentInstallment.update({
    where: { id: installmentId },
    data: { status: PaymentInstallmentStatus.PAID, paidDate: new Date() },
    include: { paymentPlan: true }
  });

  await syncPaymentPlanStatus(installment.paymentPlanId);
  revalidatePath("/");
  redirect(`/?car=${installment.paymentPlan.vehicleId}&tab=costs`);
}

export async function markInstallmentUnpaid(installmentId: string) {
  const current = await prisma.paymentInstallment.findUnique({ where: { id: installmentId }, include: { paymentPlan: true } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.paymentPlan.vehicleId);

  const installment = await prisma.paymentInstallment.update({
    where: { id: installmentId },
    data: { status: PaymentInstallmentStatus.UNPAID, paidDate: null },
    include: { paymentPlan: true }
  });

  await syncPaymentPlanStatus(installment.paymentPlanId);
  revalidatePath("/");
  redirect(`/?car=${installment.paymentPlan.vehicleId}&tab=costs`);
}

export async function updatePaymentInstallment(installmentId: string, formData: FormData) {
  const current = await prisma.paymentInstallment.findUnique({
    where: { id: installmentId },
    include: { paymentPlan: true }
  });
  if (!current) redirect("/");
  await requireVehicleAccess(current.paymentPlan.vehicleId);

  const amount = decimalValue(formData, "amount");
  const dueDate = dateValue(formData, "dueDate");
  const status = enumValue(PaymentInstallmentStatus, text(formData, "status")) as PaymentInstallmentStatus | undefined;
  if (!amount || !dueDate || !status) redirect(`/?car=${current.paymentPlan.vehicleId}&tab=costs&error=installment`);

  await prisma.paymentInstallment.update({
    where: { id: installmentId },
    data: {
      amount,
      dueDate,
      status,
      paidDate: status === PaymentInstallmentStatus.PAID ? nullableDate(formData, "paidDate") ?? new Date() : null,
      notes: text(formData, "notes")
    }
  });

  await syncPaymentPlanStatus(current.paymentPlanId);
  revalidatePath("/");
  redirect(`/?car=${current.paymentPlan.vehicleId}&tab=costs`);
}

export async function deleteVehicle(vehicleId: string) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect(`/?car=${vehicleId}&tab=general`);

  // Rows cascade with the car; its uploaded files are removed from disk here.
  for (const file of await prisma.fileAttachment.findMany({ where: { vehicleId } })) await removeStoredFile(file.path);
  await prisma.vehicle.delete({ where: { id: vehicleId } });
  revalidatePath("/");
  redirect("/?deleted=1");
}

export async function importJsonData(formData: FormData) {
  const session = await requireAdmin();
  const currentUser = await resolveSessionUser(session);
  const file = formData.get("jsonFile");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings?section=backup&import=missing");
  }

  let payload: unknown;
  try {
    payload = await readBackupFile(file);
  } catch {
    redirect("/settings?section=backup&import=invalid");
  }

  const result = await importBackup(payload, currentUser);
  if (!result.vehicles) redirect("/settings?section=backup&import=empty");

  revalidatePath("/");
    revalidatePath("/alerts");
  redirect("/settings?section=backup&import=ok");
}

export async function createUser(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/");

  const email = text(formData, "email")?.toLowerCase();
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const role = text(formData, "role") === "ADMIN" ? Role.ADMIN : Role.DRIVER;

  if (!email || !password || !firstName || !lastName || password.length < 8) {
    redirect("/users?error=invalid");
  }

  if (password !== confirmPassword) {
    redirect("/users?error=password-mismatch");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser) {
    redirect("/users?error=email-exists");
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName,
      lastName,
      role
    }
  });

  revalidatePath("/users");
}

export async function updateUser(userId: string, formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/");

  const email = text(formData, "email")?.toLowerCase();
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const role = text(formData, "role") === "ADMIN" ? Role.ADMIN : Role.DRIVER;
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");

  if (!email || !firstName || !lastName) {
    redirect(`/users/${userId}/edit?error=invalid`);
  }

  if (password) {
    if (password.length < 8) {
      redirect(`/users/${userId}/edit?error=invalid`);
    }
    if (password !== confirmPassword) {
      redirect(`/users/${userId}/edit?error=password-mismatch`);
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  if (existingUser && existingUser.id !== userId) {
    redirect(`/users/${userId}/edit?error=email-exists`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      firstName,
      lastName,
      role,
      profileImageUrl: nullableText(formData, "profileImageUrl"),
      licenseCategory: nullableText(formData, "licenseCategory"),
      licenseIssuedAt: nullableDate(formData, "licenseIssuedAt"),
      licenseExpiresAt: nullableDate(formData, "licenseExpiresAt"),
      idCardIssuedAt: nullableDate(formData, "idCardIssuedAt"),
      idCardExpiresAt: nullableDate(formData, "idCardExpiresAt"),
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {})
    }
  });

  revalidatePath("/users");
  revalidatePath(`/users/${userId}/edit`);
  redirect("/users");
}

export async function deleteUser(userId: string) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN" || session.user.id === userId) redirect("/users");

  await prisma.vehicle.updateMany({ where: { driverId: userId }, data: { driverId: null } });
  // Rows cascade with the user; the files on disk have to be removed by hand.
  for (const file of await prisma.fileAttachment.findMany({ where: { userId } })) await removeStoredFile(file.path);
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/users");
}

export async function dismissReminder(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId }, select: { vehicleId: true } });
  if (!reminder) redirect("/alerts");
  await requireVehicleAccess(reminder.vehicleId);
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: "DISMISSED" }
  });
  revalidatePath("/alerts");
  revalidatePath("/");
}

export async function addServiceRecord(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const servicedAt = dateValue(formData, "servicedAt");
  const cost = decimalValue(formData, "cost");

  if (!servicedAt || !cost) redirect(`/?car=${vehicleId}&tab=costs&error=service`);

  await prisma.serviceRecord.create({
    data: {
      vehicleId,
      servicedAt,
      odometerKm: intValue(formData, "odometerKm"),
      nextServiceAtKm: intValue(formData, "nextServiceAtKm"),
      cost,
      notes: text(formData, "notes")
    }
  });

  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=costs`);
}

export async function updateServiceRecord(recordId: string, formData: FormData) {
  const current = await prisma.serviceRecord.findUnique({ where: { id: recordId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const servicedAt = dateValue(formData, "servicedAt");
  const cost = decimalValue(formData, "cost");

  if (!servicedAt || !cost) redirect(`/?car=${current.vehicleId}&tab=costs&error=service`);

  await prisma.serviceRecord.update({
    where: { id: recordId },
    data: {
      servicedAt,
      odometerKm: nullableInt(formData, "odometerKm"),
      nextServiceAtKm: nullableInt(formData, "nextServiceAtKm"),
      odometerNotifiedAt: nullableInt(formData, "nextServiceAtKm") === current.nextServiceAtKm ? current.odometerNotifiedAt : null,
      cost,
      notes: text(formData, "notes")
    }
  });

  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=costs`);
}

export async function deleteServiceRecord(recordId: string) {
  const current = await prisma.serviceRecord.findUnique({ where: { id: recordId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  await prisma.serviceRecord.delete({ where: { id: recordId } });
  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=costs`);
}

export async function addTireSet(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const type = text(formData, "type") as TireType | undefined;
  const brand = text(formData, "brand");
  const size = text(formData, "size");
  const purchasedAt = dateValue(formData, "purchasedAt");

  if (!type || !brand || !size || !purchasedAt) {
    redirect(`/?car=${vehicleId}&tab=tires&error=tires`);
  }

  await prisma.tireSet.create({
    data: {
      vehicleId,
      type,
      brand,
      model: text(formData, "model"),
      size,
      cost: decimalValue(formData, "cost"),
      purchasedAt,
      notes: text(formData, "notes")
    }
  });

  revalidatePath("/");
  redirect(`/?car=${vehicleId}&tab=tires`);
}

export async function updateTireSet(tireSetId: string, formData: FormData) {
  const current = await prisma.tireSet.findUnique({ where: { id: tireSetId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const type = text(formData, "type") as TireType | undefined;
  const brand = text(formData, "brand");
  const size = text(formData, "size");
  const purchasedAt = dateValue(formData, "purchasedAt");

  if (!type || !brand || !size || !purchasedAt) {
    redirect(`/?car=${current.vehicleId}&tab=tires&error=tires`);
  }

  await prisma.tireSet.update({
    where: { id: tireSetId },
    data: {
      type,
      brand,
      model: text(formData, "model"),
      size,
      cost: nullableDecimal(formData, "cost"),
      purchasedAt,
      notes: text(formData, "notes")
    }
  });

  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=tires`);
}

export async function deleteTireSet(tireSetId: string) {
  const current = await prisma.tireSet.findUnique({ where: { id: tireSetId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  await prisma.tireSet.delete({ where: { id: tireSetId } });
  revalidatePath("/");
  redirect(`/?car=${current.vehicleId}&tab=tires`);
}
