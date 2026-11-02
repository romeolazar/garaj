import { DocumentType, ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CostCategory = { id?: string; key: string; name: string; color: string; icon: string; sortOrder: number; isActive: boolean };

// Built-in categories. Documents, revizii and anvelope map onto these keys; custom ones get a "custom-…" key.
export const DEFAULT_COST_CATEGORIES: Array<Omit<CostCategory, "isActive">> = [
  { key: "insurance", name: "Asigurări", color: "#5b4bf5", icon: "shield", sortOrder: 0 },
  { key: "service", name: "Revizii & service", color: "#64748b", icon: "wrench", sortOrder: 1 },
  { key: "repair", name: "Reparații", color: "#e11d48", icon: "hammer", sortOrder: 2 },
  { key: "inspection", name: "ITP", color: "#14b8a6", icon: "clipboard", sortOrder: 3 },
  { key: "tolls", name: "Rovinietă & taxe", color: "#f97316", icon: "ticket", sortOrder: 4 },
  { key: "loan", name: "Rate & credit", color: "#c026d3", icon: "landmark", sortOrder: 5 },
  { key: "fuel", name: "Combustibil", color: "#f59e0b", icon: "fuel", sortOrder: 6 },
  { key: "charging", name: "Încărcare", color: "#22c55e", icon: "zap", sortOrder: 7 },
  { key: "tires", name: "Anvelope", color: "#78716c", icon: "tire", sortOrder: 8 },
  { key: "accessories", name: "Accesorii & dotări", color: "#8b5cf6", icon: "sparkles", sortOrder: 9 },
  { key: "wash", name: "Spălătorie", color: "#0ea5e9", icon: "droplets", sortOrder: 10 },
  { key: "parking", name: "Parcare", color: "#475569", icon: "parking", sortOrder: 11 },
  { key: "subscription", name: "Abonamente", color: "#ec4899", icon: "repeat", sortOrder: 12 },
  { key: "equipment", name: "Echipament obligatoriu", color: "#a16207", icon: "kit", sortOrder: 13 },
  { key: "fines", name: "Amenzi", color: "#7c2d12", icon: "gavel", sortOrder: 14 },
  { key: "other", name: "Altele", color: "#a8a3bd", icon: "tag", sortOrder: 15 }
];

export const CATEGORY_ICONS = ["shield", "wrench", "hammer", "clipboard", "ticket", "landmark", "fuel", "zap", "tire", "sparkles", "droplets", "parking", "repeat", "kit", "gavel", "tag"] as const;

export const EXPENSE_CATEGORY_KEY: Record<ExpenseCategory, string> = {
  SERVICE: "service",
  FUEL: "fuel",
  CHARGING: "charging",
  CAR_WASH: "wash",
  PARKING: "parking",
  ACCESSORIES: "accessories",
  REPAIR: "repair",
  SUBSCRIPTION: "subscription",
  OTHER: "other"
};

export const DOCUMENT_CATEGORY_KEY: Record<DocumentType, string> = {
  RCA: "insurance",
  CASCO: "insurance",
  CASCO_RATE: "insurance",
  ITP: "inspection",
  ROVINIETA: "tolls",
  CAR_LOAN: "loan",
  FIRST_AID_KIT: "equipment",
  FIRE_EXTINGUISHER: "equipment",
  WARRANTY: "other",
  DRIVER_LICENSE: "other",
  ID_CARD: "other"
};

// The legacy enum is still required on Expense; pick the closest one for a category key.
export function expenseEnumForKey(key: string): ExpenseCategory {
  const match = Object.entries(EXPENSE_CATEGORY_KEY).find(([, value]) => value === key);
  return (match?.[0] as ExpenseCategory | undefined) ?? ExpenseCategory.OTHER;
}

export async function ensureCostCategories() {
  for (const category of DEFAULT_COST_CATEGORIES) {
    await prisma.expenseCategoryConfig.upsert({
      where: { key: category.key },
      update: {},
      create: category
    });
  }
}

export async function loadCostCategories(): Promise<CostCategory[]> {
  const rows = await prisma.expenseCategoryConfig.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.length ? rows : DEFAULT_COST_CATEGORIES.map((category) => ({ ...category, isActive: true }));
}
