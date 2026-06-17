import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertTriangle, Car, FileCheck2, Gauge, LayoutGrid, List, Plus, ReceiptText, Rows3, Warehouse, type LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatKilometers } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { documentLabels, expenseLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { view: rawView } = await searchParams;
  const view = rawView === "compact" || rawView === "card" ? rawView : "poster";

  const vehicleWhere = session.user.role === "ADMIN" ? {} : { driverId: session.user.id };
  const [vehicleCount, vehicles, recentExpenses] =
    await Promise.all([
      prisma.vehicle.count({ where: vehicleWhere }),
      prisma.vehicle.findMany({
        where: vehicleWhere,
        orderBy: { createdAt: "desc" },
        include: {
          documents: { orderBy: { validUntil: "asc" } },
          expenses: { orderBy: { occurredAt: "desc" } },
          reminders: { where: { status: "PENDING", notifyAt: { lte: new Date() } }, orderBy: { dueAt: "asc" } }
        }
      }),
      prisma.expense.findMany({ take: 4, where: { vehicle: vehicleWhere }, orderBy: { occurredAt: "desc" }, include: { vehicle: true } })
    ]);

  const vehicleMessage =
    vehicleCount === 1 ? "Ai 1 vehicul in garaj." : `Ai ${vehicleCount} vehicule in garaj.`;

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black">
            <Warehouse className="size-9 text-primary" />
            Garajul meu
          </h1>
          <p className="mt-2 text-muted-foreground">{vehicleMessage}</p>
        </div>
        {session.user.role === "ADMIN" ? (
          <Link className="btn" href="/vehicles/new">
            <Plus className="size-4" />
            Adauga vehicul
          </Link>
        ) : null}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <Car className="size-5 text-primary" />
            Mașini
          </h2>
          <div className="flex rounded-md border border-border bg-muted/30 p-1 text-sm">
            <ViewLink href="/?view=compact" active={view === "compact"} icon={List} label="Compact" />
            <ViewLink href="/?view=card" active={view === "card"} icon={LayoutGrid} label="Card" />
            <ViewLink href="/?view=poster" active={view === "poster"} icon={Rows3} label="Poster" />
          </div>
        </div>
        {vehicles.length === 0 ? (
          <div className="panel flex min-h-44 flex-col items-center justify-center p-5 text-muted-foreground">
            <Car className="mb-4 size-10 opacity-40" />
            {session.user.role === "ADMIN" ? "Nu exista vehicule in garaj." : "Nu aveti o masina alocata in garaj."}
          </div>
        ) : (
          <div className={view === "compact" ? "grid gap-3" : view === "poster" ? "grid gap-5 xl:grid-cols-2" : "grid gap-5 xl:grid-cols-2"}>
            {vehicles.map((vehicle) => {
              const documentCosts = vehicle.documents.reduce((sum, item) => sum + Number(item.cost ?? 0), 0);
              const expenseCosts = vehicle.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
              const total = expenseCosts + documentCosts;
              const activeDocuments = vehicle.documents.filter((doc) => doc.validUntil >= new Date()).length;
              const latestExpense = vehicle.expenses[0];
              const latestOdometer = vehicle.expenses.find((expense) => expense.odometerKm)?.odometerKm;
              const nextDocument = vehicle.documents[0];

              if (view === "compact") {
                return (
                  <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`} className="panel grid gap-3 p-4 transition hover:border-primary md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div className="flex items-center gap-3">
                      {vehicle.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={vehicle.imageUrl} alt="" className="size-10 rounded-md border border-border bg-white object-contain p-1" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary"><Car className="size-5" /></div>
                      )}
                      <div>
                        <div className="font-black">{vehicle.plateNumber}</div>
                        <div className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{formatKilometers(latestOdometer)}</div>
                    <div className="text-sm text-muted-foreground">{nextDocument ? `${documentLabels[nextDocument.type]} · ${formatDate(nextDocument.validUntil)}` : "N/A"}</div>
                    <div className="font-black">{formatCurrency(total)}</div>
                  </Link>
                );
              }

              if (view === "poster") {
                return (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="relative block min-h-64 overflow-hidden rounded-lg border border-border p-5 shadow-xl transition hover:border-primary"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(10,10,12,0.25), rgba(10,10,12,0.9)), url('${vehicle.backgroundImageUrl || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80"}')`,
                      backgroundPosition: "center",
                      backgroundSize: "cover"
                    }}
                  >
                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="mb-3 flex items-center gap-3">
                        {vehicle.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vehicle.imageUrl} alt="" className="size-12 rounded-md border border-white/20 bg-white object-contain p-1" />
                        ) : (
                          <div className="flex size-12 items-center justify-center rounded-md bg-black/40 text-white"><Car className="size-6" /></div>
                        )}
                        <div>
                          <div className="text-2xl font-black text-white">{vehicle.plateNumber}</div>
                          <div className="text-sm text-white/75">{vehicle.make} {vehicle.model}</div>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-white/80 md:grid-cols-2">
                        <span>Costuri: <strong className="text-white">{formatCurrency(total)}</strong></span>
                        <span>Kilometraj: <strong className="text-white">{formatKilometers(latestOdometer)}</strong></span>
                        <span>Registru: <strong className="text-white">{nextDocument ? `${documentLabels[nextDocument.type]} · ${formatDate(nextDocument.validUntil)}` : "N/A"}</strong></span>
                      </div>
                    </div>
                  </Link>
                );
              }

              return (
                <Link key={vehicle.id} href={`/vehicles/${vehicle.id}`} className="panel block p-5 transition hover:border-primary">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {vehicle.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={vehicle.imageUrl} alt="" className="size-12 rounded-md border border-border bg-white object-contain p-1" />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Car className="size-6" />
                        </div>
                      )}
                      <div>
                        <div className="text-xl font-black">{vehicle.plateNumber}</div>
                        <div className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Costuri</div>
                      <div className="text-xl font-black">{formatCurrency(total)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <DashboardMetric icon={FileCheck2} label="Registru activ" value={activeDocuments.toString()} />
                    <DashboardMetric icon={AlertTriangle} label="Alerte in asteptare" value={vehicle.reminders.length.toString()} tone={vehicle.reminders.length > 0 ? "text-amber-300" : "text-accent"} />
                    <DashboardMetric icon={ReceiptText} label="Ultima cheltuiala" value={latestExpense ? `${expenseLabels[latestExpense.category]} · ${formatCurrency(latestExpense.amount)}` : "N/A"} />
                    <DashboardMetric icon={Gauge} label="Ultimul kilometraj" value={formatKilometers(latestOdometer)} />
                  </div>

                  <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cheltuieli masina</span><strong>{formatCurrency(expenseCosts)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Costuri registru</span><strong>{formatCurrency(documentCosts)}</strong></div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <ReceiptText className="size-4 text-accent" />
          Activitate recenta
        </h2>
        <div className="panel p-4">
          {recentExpenses.length === 0 ? (
            <div className="flex min-h-20 items-center justify-center text-sm text-muted-foreground">Nu exista activitate recenta.</div>
          ) : (
            <div className="divide-y divide-border">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-semibold">{expenseLabels[expense.category]} - {expense.vehicle.plateNumber}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(expense.occurredAt)}</div>
                  </div>
                  <div className="font-bold">{formatCurrency(expense.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function ViewLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof List; label: string }) {
  return (
    <Link href={href} className={`inline-flex size-9 items-center justify-center rounded font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title={label} aria-label={label}>
      <Icon className="size-4" />
    </Link>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  tone = "text-foreground"
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className={`font-bold ${tone}`}>{value}</div>
    </div>
  );
}
