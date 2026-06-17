import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DocumentType, ExpenseCategory, PaymentInstallmentStatus } from "@prisma/client";
import { AlertTriangle, BarChart3, CalendarClock, Car, CreditCard, FileCheck2, ReceiptText, UsersRound } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { documentLabels, expenseLabels, paymentPlanCategoryLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

const registryExcludedTypes: DocumentType[] = [
  DocumentType.CAR_LOAN,
  DocumentType.CASCO_RATE,
  DocumentType.DRIVER_LICENSE,
  DocumentType.ID_CARD
];

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const vehicleWhere = session.user.role === "ADMIN" ? {} : { driverId: session.user.id };

  const [vehicles, expenses, users] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plateNumber: "asc" },
      include: {
        driver: true,
        documents: true,
        expenses: true,
        paymentPlans: { include: { installments: { orderBy: { dueDate: "asc" } } } }
      }
    }),
    prisma.expense.findMany({ where: { vehicle: vehicleWhere }, orderBy: { occurredAt: "desc" }, include: { vehicle: true } }),
    prisma.user.findMany({
      where: session.user.role === "ADMIN" ? {} : { id: session.user.id },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
      include: { vehicles: true }
    })
  ]);

  const vehicleCosts = vehicles
    .map((vehicle) => {
      const expenseTotal = vehicle.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      const documentTotal = vehicle.documents.reduce((sum, document) => sum + Number(document.cost ?? 0), 0);
      const remainingRates = vehicle.paymentPlans.reduce((sum, plan) => {
        return sum + plan.installments
          .filter((installment) => installment.status === PaymentInstallmentStatus.UNPAID)
          .reduce((total, installment) => total + Number(installment.amount), 0);
      }, 0);

      return {
        id: vehicle.id,
        label: `${vehicle.plateNumber} - ${vehicle.make} ${vehicle.model}`,
        expenseTotal,
        documentTotal,
        remainingRates,
        total: expenseTotal + documentTotal + remainingRates
      };
    })
    .sort((a, b) => b.total - a.total);

  const categoryCosts = Object.values(ExpenseCategory)
    .map((category) => ({
      category,
      total: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + Number(expense.amount), 0),
      count: expenses.filter((expense) => expense.category === category).length
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.total - a.total);

  const now = new Date();
  const next60Days = new Date(now);
  next60Days.setDate(next60Days.getDate() + 60);
  const expiringDocuments = vehicles
    .flatMap((vehicle) =>
      vehicle.documents
        .filter((document) => !registryExcludedTypes.includes(document.type))
        .filter((document) => document.validUntil <= next60Days)
        .map((document) => ({ document, vehicle }))
    )
    .sort((a, b) => a.document.validUntil.getTime() - b.document.validUntil.getTime());

  const paymentPlans = vehicles
    .flatMap((vehicle) =>
      vehicle.paymentPlans.map((plan) => {
        const unpaid = plan.installments.filter((installment) => installment.status === PaymentInstallmentStatus.UNPAID);
        const nextInstallment = unpaid[0] ?? null;
        const remainingAmount = unpaid.reduce((sum, installment) => sum + Number(installment.amount), 0);

        return {
          vehicle,
          plan,
          nextInstallment,
          paidCount: plan.installments.length - unpaid.length,
          remainingCount: unpaid.length,
          remainingAmount
        };
      })
    )
    .sort((a, b) => {
      if (!a.nextInstallment) return 1;
      if (!b.nextInstallment) return -1;
      return a.nextInstallment.dueDate.getTime() - b.nextInstallment.dueDate.getTime();
    });

  const monthlyExpenses = lastSixMonths().map((month) => {
    const total = expenses
      .filter((expense) => monthKey(expense.occurredAt) === month.key)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { ...month, total };
  });

  const maxMonthly = Math.max(...monthlyExpenses.map((month) => month.total), 1);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-4xl font-black">
          <BarChart3 className="size-9 text-primary" />
          Rapoarte
        </h1>
        <p className="mt-2 text-muted-foreground">Analize rapide pe baza masinilor, cheltuielilor, registrului, ratelor si soferilor.</p>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportPanel icon={Car} title="Costuri pe masina">
          <div className="divide-y divide-border">
            {vehicleCosts.map((item) => (
              <Link key={item.id} href={`/vehicles/${item.id}`} className="grid gap-2 py-3 text-sm hover:text-primary md:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-bold">{item.label}</div>
                  <div className="text-xs text-muted-foreground">Cheltuieli {formatCurrency(item.expenseTotal)} · Registru {formatCurrency(item.documentTotal)} · Rate ramase {formatCurrency(item.remainingRates)}</div>
                </div>
                <div className="font-black">{formatCurrency(item.total)}</div>
              </Link>
            ))}
            {vehicleCosts.length === 0 ? <EmptyReport /> : null}
          </div>
        </ReportPanel>

        <ReportPanel icon={ReceiptText} title="Cheltuieli pe categorii">
          <div className="grid gap-3">
            {categoryCosts.map((item) => (
              <div key={item.category} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <div className="mb-2 flex justify-between gap-3">
                  <span className="font-bold">{expenseLabels[item.category]}</span>
                  <span className="font-black">{formatCurrency(item.total)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{item.count} intrari</div>
              </div>
            ))}
            {categoryCosts.length === 0 ? <EmptyReport /> : null}
          </div>
        </ReportPanel>

        <ReportPanel icon={FileCheck2} title="Registru expirat sau scadent in 60 zile">
          <div className="divide-y divide-border">
            {expiringDocuments.slice(0, 12).map(({ document, vehicle }) => (
              <Link key={document.id} href={`/vehicles/${vehicle.id}`} className="flex justify-between gap-3 py-3 text-sm hover:text-primary">
                <div>
                  <div className="font-bold">{documentLabels[document.type]} - {vehicle.plateNumber}</div>
                  <div className="text-xs text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                </div>
                <div className={document.validUntil < now ? "font-bold text-rose-300" : "font-bold text-amber-300"}>{formatDate(document.validUntil)}</div>
              </Link>
            ))}
            {expiringDocuments.length === 0 ? <EmptyReport /> : null}
          </div>
        </ReportPanel>

        <ReportPanel icon={CreditCard} title="Planuri de plata si urmatoarele rate">
          <div className="divide-y divide-border">
            {paymentPlans.slice(0, 12).map((item) => (
              <Link key={item.plan.id} href={`/vehicles/${item.vehicle.id}`} className="grid gap-2 py-3 text-sm hover:text-primary md:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-bold">{item.plan.name} - {item.vehicle.plateNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {paymentPlanCategoryLabels[item.plan.category]} · {item.paidCount}/{item.plan.totalInstallments} platite · Rest {formatMoney(item.remainingAmount, item.plan.currency)}
                  </div>
                </div>
                <div className="font-bold">{item.nextInstallment ? formatDate(item.nextInstallment.dueDate) : "Finalizat"}</div>
              </Link>
            ))}
            {paymentPlans.length === 0 ? <EmptyReport /> : null}
          </div>
        </ReportPanel>

        <ReportPanel icon={UsersRound} title="Soferi si masini alocate">
          <div className="divide-y divide-border">
            {users.map((user) => (
              <div key={user.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-bold">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{user.vehicles.length}</div>
                  <div className="text-xs text-muted-foreground">masini</div>
                </div>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel icon={CalendarClock} title="Evolutie cheltuieli pe ultimele 6 luni">
          <div className="grid gap-3">
            {monthlyExpenses.map((month) => (
              <div key={month.key} className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-bold">{month.label}</span>
                  <span>{formatCurrency(month.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((month.total / maxMonthly) * 100, month.total > 0 ? 4 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ReportPanel>
      </section>

      <section className="panel mt-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><AlertTriangle className="size-5 text-amber-300" /> Rezumat rapid</h2>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <SummaryItem label="Masini" value={vehicles.length.toString()} />
          <SummaryItem label="Cheltuieli totale" value={formatCurrency(expenses.reduce((sum, expense) => sum + Number(expense.amount), 0))} />
          <SummaryItem label="Documente scadente" value={expiringDocuments.length.toString()} />
          <SummaryItem label="Planuri rate" value={paymentPlans.length.toString()} />
        </div>
      </section>
    </AppShell>
  );
}

function ReportPanel({ icon: Icon, title, children }: { icon: typeof BarChart3; title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Icon className="size-5 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}

function EmptyReport() {
  return <div className="flex min-h-20 items-center justify-center text-sm text-muted-foreground">Nu exista date pentru acest raport.</div>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function lastSixMonths() {
  const months: Array<{ key: string; label: string }> = [];
  const date = new Date();
  date.setDate(1);

  for (let index = 5; index >= 0; index -= 1) {
    const current = new Date(date.getFullYear(), date.getMonth() - index, 1);
    months.push({
      key: monthKey(current),
      label: current.toLocaleDateString("ro-RO", { month: "short", year: "numeric" })
    });
  }

  return months;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: unknown, currency = "RON") {
  return `${Number(value ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} ${currency}`;
}
