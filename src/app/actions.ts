"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { addMonths } from "date-fns";
import { DocumentType, ExpenseCategory, FuelType, PaymentFrequency, PaymentInstallmentStatus, PaymentPlanCategory, PaymentPlanStatus, Role, TireType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rebuildDocumentReminders } from "@/lib/reminders";
import { paymentTypes } from "@/lib/labels";

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

function decimalImportValue(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function dateImportValue(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
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
  redirect(`/vehicles/${vehicle.id}`);
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
      ...(session.user.role === "ADMIN" ? { driverId: nullableText(formData, "driverId") } : {})
    }
  });

  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
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

  if (!type || !validUntil) redirect(`/vehicles/${vehicleId}?tab=registru&error=document`);

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
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?tab=registru`);
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

  if (!type || !validUntil) redirect(`/vehicles/${current.vehicleId}?tab=registru&error=document`);

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
  revalidatePath(`/vehicles/${document.vehicleId}`);
  redirect(`/vehicles/${document.vehicleId}?tab=registru`);
}

export async function deleteVehicleDocument(documentId: string) {
  const document = await prisma.vehicleDocument.findUnique({ where: { id: documentId } });
  if (!document) redirect("/");
  await requireVehicleAccess(document.vehicleId);

  await prisma.vehicleDocument.delete({ where: { id: documentId } });
  revalidatePath(`/vehicles/${document.vehicleId}`);
  redirect(`/vehicles/${document.vehicleId}?tab=registru`);
}

export async function addExpense(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const category = text(formData, "category") as ExpenseCategory | undefined;
  const amount = decimalValue(formData, "amount");
  const occurredAt = dateValue(formData, "occurredAt");

  if (!category || !amount || !occurredAt) redirect(`/vehicles/${vehicleId}?tab=cheltuieli&error=expense`);

  await prisma.expense.create({
    data: {
      vehicleId,
      category,
      amount,
      occurredAt,
      odometerKm: intValue(formData, "odometerKm"),
      notes: text(formData, "notes")
    }
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/");
  redirect(`/vehicles/${vehicleId}?tab=cheltuieli`);
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const current = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const category = text(formData, "category") as ExpenseCategory | undefined;
  const amount = decimalValue(formData, "amount");
  const occurredAt = dateValue(formData, "occurredAt");

  if (!category || !amount || !occurredAt) redirect(`/vehicles/${current.vehicleId}?tab=cheltuieli&error=expense`);

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      category,
      amount,
      occurredAt,
      odometerKm: nullableInt(formData, "odometerKm"),
      notes: text(formData, "notes")
    }
  });

  revalidatePath(`/vehicles/${current.vehicleId}`);
  revalidatePath("/");
  redirect(`/vehicles/${current.vehicleId}?tab=cheltuieli`);
}

export async function deleteExpense(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) redirect("/");
  await requireVehicleAccess(expense.vehicleId);

  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/vehicles/${expense.vehicleId}`);
  revalidatePath("/");
  redirect(`/vehicles/${expense.vehicleId}?tab=cheltuieli`);
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
    redirect(`/vehicles/${vehicleId}?tab=rate&error=payment-plan`);
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

  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?tab=rate`);
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
    redirect(`/vehicles/${current.vehicleId}?tab=rate&error=payment-plan`);
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
  revalidatePath(`/vehicles/${current.vehicleId}`);
  redirect(`/vehicles/${current.vehicleId}?tab=rate`);
}

export async function deletePaymentPlan(planId: string) {
  const plan = await prisma.paymentPlan.findUnique({ where: { id: planId } });
  if (!plan) redirect("/");
  await requireVehicleAccess(plan.vehicleId);

  await prisma.paymentPlan.delete({ where: { id: planId } });
  revalidatePath(`/vehicles/${plan.vehicleId}`);
  redirect(`/vehicles/${plan.vehicleId}?tab=rate`);
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
  revalidatePath(`/vehicles/${installment.paymentPlan.vehicleId}`);
  redirect(`/vehicles/${installment.paymentPlan.vehicleId}?tab=rate`);
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
  revalidatePath(`/vehicles/${installment.paymentPlan.vehicleId}`);
  redirect(`/vehicles/${installment.paymentPlan.vehicleId}?tab=rate`);
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
  if (!amount || !dueDate || !status) redirect(`/vehicles/${current.paymentPlan.vehicleId}?tab=rate&error=installment`);

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
  revalidatePath(`/vehicles/${current.paymentPlan.vehicleId}`);
  redirect(`/vehicles/${current.paymentPlan.vehicleId}?tab=rate`);
}

export async function deleteVehicle(vehicleId: string) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect(`/vehicles/${vehicleId}`);

  await prisma.vehicle.delete({ where: { id: vehicleId } });
  revalidatePath("/");
  revalidatePath("/vehicles");
  redirect("/vehicles");
}

export async function importJsonData(formData: FormData) {
  const session = await requireSession();
  const currentUser = await resolveSessionUser(session);
  const file = formData.get("jsonFile");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings?import=missing");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    redirect("/settings?import=invalid");
  }

  const root = objectValue(payload);
  const usersList = arrayValue(root?.users);

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
          passwordHash: await bcrypt.hash("SchimbaMa123!", 10)
        }
      });
    }
  }

  const vehicles = arrayValue(root?.vehicles);

  if (vehicles.length === 0) {
    redirect("/settings?import=empty");
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
              passwordHash: await bcrypt.hash("SchimbaMa123!", 10)
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
          notes: stringValue(expense.notes)
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
  }

  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath("/alerts");
  redirect("/vehicles?import=ok");
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
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/users");
}

export async function updateSettings(formData: FormData) {
  await requireSession();

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {
      theme: text(formData, "theme") ?? "system",
      telegramBotToken: text(formData, "telegramBotToken"),
      telegramChatId: text(formData, "telegramChatId"),
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpUser: text(formData, "smtpUser"),
      smtpPassword: text(formData, "smtpPassword"),
      smtpFrom: text(formData, "smtpUser")
    },
    create: {
      id: "default",
      theme: text(formData, "theme") ?? "system",
      telegramBotToken: text(formData, "telegramBotToken"),
      telegramChatId: text(formData, "telegramChatId"),
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpUser: text(formData, "smtpUser"),
      smtpPassword: text(formData, "smtpPassword"),
      smtpFrom: text(formData, "smtpUser")
    }
  });

  revalidatePath("/settings");
}

export async function testTelegramNotification() {
  await requireSession();

  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if (!settings?.telegramBotToken || !settings.telegramChatId) {
    redirect("/settings?telegram=missing");
  }

  const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: settings.telegramChatId,
      text: "Test notificare Garaj: Telegram este configurat corect."
    })
  });

  if (!response.ok) {
    redirect("/settings?telegram=failed");
  }

  redirect("/settings?telegram=ok");
}

export async function testEmailConfiguration() {
  const session = await requireSession();
  const [settings, user] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: "default" } }),
    prisma.user.findUnique({ where: { id: session.user.id } })
  ]);

  if (!settings?.smtpUser || !settings.smtpPassword || !user?.email) {
    redirect("/settings?email=missing");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword
    }
  });

  try {
    await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser,
      to: user.email,
      subject: "Test configurare email Garaj",
      text: "Test notificare Garaj: Gmail SMTP este configurat corect."
    });
  } catch {
    redirect("/settings?email=failed");
  }

  redirect("/settings?email=ok");
}

export async function dismissReminder(reminderId: string) {
  await requireSession();
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

  if (!servicedAt || !cost) redirect(`/vehicles/${vehicleId}?tab=revizii&error=service`);

  await prisma.serviceRecord.create({
    data: {
      vehicleId,
      servicedAt,
      odometerKm: intValue(formData, "odometerKm"),
      cost,
      notes: text(formData, "notes")
    }
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?tab=revizii`);
}

export async function updateServiceRecord(recordId: string, formData: FormData) {
  const current = await prisma.serviceRecord.findUnique({ where: { id: recordId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  const servicedAt = dateValue(formData, "servicedAt");
  const cost = decimalValue(formData, "cost");

  if (!servicedAt || !cost) redirect(`/vehicles/${current.vehicleId}?tab=revizii&error=service`);

  await prisma.serviceRecord.update({
    where: { id: recordId },
    data: {
      servicedAt,
      odometerKm: nullableInt(formData, "odometerKm"),
      cost,
      notes: text(formData, "notes")
    }
  });

  revalidatePath(`/vehicles/${current.vehicleId}`);
  redirect(`/vehicles/${current.vehicleId}?tab=revizii`);
}

export async function deleteServiceRecord(recordId: string) {
  const current = await prisma.serviceRecord.findUnique({ where: { id: recordId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  await prisma.serviceRecord.delete({ where: { id: recordId } });
  revalidatePath(`/vehicles/${current.vehicleId}`);
  redirect(`/vehicles/${current.vehicleId}?tab=revizii`);
}

export async function addTireSet(vehicleId: string, formData: FormData) {
  await requireVehicleAccess(vehicleId);

  const type = text(formData, "type") as TireType | undefined;
  const brand = text(formData, "brand");
  const size = text(formData, "size");
  const purchasedAt = dateValue(formData, "purchasedAt");

  if (!type || !brand || !size || !purchasedAt) {
    redirect(`/vehicles/${vehicleId}?tab=anvelope&error=tires`);
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

  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?tab=anvelope`);
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
    redirect(`/vehicles/${current.vehicleId}?tab=anvelope&error=tires`);
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

  revalidatePath(`/vehicles/${current.vehicleId}`);
  redirect(`/vehicles/${current.vehicleId}?tab=anvelope`);
}

export async function deleteTireSet(tireSetId: string) {
  const current = await prisma.tireSet.findUnique({ where: { id: tireSetId } });
  if (!current) redirect("/");
  await requireVehicleAccess(current.vehicleId);

  await prisma.tireSet.delete({ where: { id: tireSetId } });
  revalidatePath(`/vehicles/${current.vehicleId}`);
  redirect(`/vehicles/${current.vehicleId}?tab=anvelope`);
}
