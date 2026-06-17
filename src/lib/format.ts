import { format, formatDistanceToNowStrict, isBefore } from "date-fns";
import { ro } from "date-fns/locale";

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "N/A";
  return format(new Date(date), "dd.MM.yyyy", { locale: ro });
}

export function formatCurrency(value: unknown) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0
  }).format(number);
}

export function formatKilometers(value: number | null | undefined) {
  if (!value) return "N/A";
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value)} km`;
}

export function powerToHp(kw: number | null | undefined) {
  if (!kw) return null;
  return Math.round(kw * 1.34102);
}

export function relativeDue(date: Date) {
  const label = formatDistanceToNowStrict(date, { addSuffix: true, locale: ro });
  return isBefore(date, new Date()) ? `expirat ${label}` : label;
}
