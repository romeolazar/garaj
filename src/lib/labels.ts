import { DocumentType, ExpenseCategory, FuelType, PaymentFrequency, PaymentInstallmentStatus, PaymentPlanCategory, PaymentPlanStatus, Role } from "@prisma/client";

export const documentLabels: Record<DocumentType, string> = {
  ITP: "ITP",
  RCA: "RCA",
  CASCO: "CASCO",
  ROVINIETA: "Rovinieta",
  FIRST_AID_KIT: "Trusa medicala",
  FIRE_EXTINGUISHER: "Extinctor",
  WARRANTY: "Garantie",
  CAR_LOAN: "Rata masina",
  CASCO_RATE: "Rata CASCO",
  DRIVER_LICENSE: "Permis conducere",
  ID_CARD: "Carte de identitate"
};

export const expenseLabels: Record<ExpenseCategory, string> = {
  SERVICE: "Revizie",
  FUEL: "Alimentare",
  CHARGING: "Incarcare",
  CAR_WASH: "Spalatorie",
  PARKING: "Parcare",
  ACCESSORIES: "Accesorii",
  REPAIR: "Reparatie",
  SUBSCRIPTION: "Subscriptie",
  OTHER: "Alta cheltuiala"
};

export const fuelLabels: Record<FuelType, string> = {
  ELECTRIC: "Electric",
  DIESEL: "Diesel",
  GPL: "GPL",
  PETROL: "Benzina",
  HYBRID: "Hibrid"
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrator",
  DRIVER: "Șofer"
};

export const paymentTypes: DocumentType[] = [DocumentType.CAR_LOAN, DocumentType.CASCO_RATE];

export const paymentFrequencyLabels: Record<PaymentFrequency, string> = {
  MONTHLY: "Lunar",
  QUARTERLY: "Trimestrial",
  SEMIANNUAL: "Semestrial",
  ANNUAL: "Anual"
};

export const paymentPlanCategoryLabels: Record<PaymentPlanCategory, string> = {
  CAR_CREDIT: "Credit masina",
  CASCO: "CASCO",
  RCA: "RCA in rate",
  LEASING: "Leasing",
  EXTENDED_WARRANTY: "Garantie extinsa",
  SUBSCRIPTION: "Abonament / serviciu auto",
  OTHER: "Alta plata"
};

export const paymentPlanStatusLabels: Record<PaymentPlanStatus, string> = {
  ACTIVE: "Activ",
  COMPLETED: "Finalizat",
  CANCELLED: "Anulat"
};

export const paymentInstallmentStatusLabels: Record<PaymentInstallmentStatus, string> = {
  PAID: "Platita",
  UNPAID: "Neplatita",
  CANCELLED: "Anulata"
};
