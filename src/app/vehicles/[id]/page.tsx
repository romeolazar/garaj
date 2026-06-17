import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DocumentType, ExpenseCategory, PaymentFrequency, PaymentInstallmentStatus, PaymentPlanCategory, PaymentPlanStatus } from "@prisma/client";
import { BadgeEuro, Box, BriefcaseMedical, Bubbles, Car, CarTaxiFront, Check, ClipboardList, CreditCard, FileCheck, FileCheck2, FileSearch2, FireExtinguisher, Fuel, Gauge, Hammer, Pencil, PlugZap, Plus, ReceiptText, RotateCcw, Save, SquareParking, Trash2, Wifi, Wrench } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatKilometers, powerToHp, relativeDue } from "@/lib/format";
import { addExpense, addVehicleDocument, createPaymentPlan, deleteExpense, deletePaymentPlan, deleteVehicle, deleteVehicleDocument, markInstallmentPaid, markInstallmentUnpaid, updateExpense, updatePaymentInstallment, updatePaymentPlan, updateVehicleDocument } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { documentLabels, expenseLabels, fuelLabels, paymentFrequencyLabels, paymentInstallmentStatusLabels, paymentPlanCategoryLabels, paymentPlanStatusLabels, paymentTypes } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { validUntil: "asc" } },
      reminders: { orderBy: { dueAt: "asc" }, take: 8 },
      expenses: { orderBy: { occurredAt: "desc" } },
      paymentPlans: {
        orderBy: { createdAt: "desc" },
        include: { installments: { orderBy: { installmentNumber: "asc" } } }
      },
      driver: true
    }
  });

  if (!vehicle) notFound();
  if (session.user.role !== "ADMIN" && vehicle.driverId !== session.user.id) notFound();

  const totalExpenses = vehicle.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const documentCosts = vehicle.documents.reduce((sum, item) => sum + Number(item.cost ?? 0), 0);
  const registryTypes = Object.values(DocumentType).filter((type) => !paymentTypes.includes(type) && type !== DocumentType.DRIVER_LICENSE && type !== DocumentType.ID_CARD);
  const documents = vehicle.documents.filter((doc) => registryTypes.includes(doc.type));
  const hp = powerToHp(vehicle.powerKw);
  const latestOdometer = vehicle.expenses.find((expense) => expense.odometerKm)?.odometerKm;

  return (
    <AppShell>
      <section
        className="group relative mb-7 overflow-hidden rounded-lg border border-border bg-card p-5 shadow-xl"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(10,10,12,0.88), rgba(10,10,12,0.58)), url('${vehicle.backgroundImageUrl || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80"}')`,
          backgroundPosition: "center",
          backgroundSize: "cover"
        }}
      >
        <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            {vehicle.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vehicle.imageUrl} alt="" className="size-20 rounded-lg border border-white/20 bg-white object-contain p-2 shadow-lg" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-lg border border-white/20 bg-black/35 text-white shadow-lg">
                <Car className="size-9" />
              </div>
            )}
            <div>
              <div className="text-sm font-semibold uppercase text-white/65">Masina</div>
              <div className="text-3xl font-black text-white">{vehicle.make} {vehicle.model}</div>
              <div className="mt-1 text-sm text-white/75">{vehicle.plateNumber}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/35 px-4 py-3 backdrop-blur">
              <Gauge className="size-6 text-primary" />
              <div>
                <div className="text-xs font-semibold uppercase text-white/60">Kilometraj</div>
                <div className="font-bold text-white">{formatKilometers(latestOdometer)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/35 px-4 py-3 backdrop-blur">
              {vehicle.driver?.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vehicle.driver.profileImageUrl} alt="" className="size-12 rounded-full border border-white/20 object-cover" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-primary text-sm font-black text-primary-foreground">
                  {driverInitials(vehicle.driver)}
                </div>
              )}
              <div>
                <div className="text-xs font-semibold uppercase text-white/60">Sofer</div>
                <div className="font-bold text-white">{vehicle.driver ? `${vehicle.driver.firstName} ${vehicle.driver.lastName}` : "Nealocat"}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 right-4 z-20 flex gap-2 opacity-0 transition group-hover:opacity-100">
          <Link href={`/vehicles/${vehicle.id}/edit`} className="flex size-10 items-center justify-center rounded-md border border-white/20 bg-black/45 text-white backdrop-blur hover:border-primary" title="Editeaza">
            <Pencil className="size-4" />
          </Link>
          {session.user.role === "ADMIN" ? (
            <DeleteVehicleButton action={deleteVehicle.bind(null, vehicle.id)} plateNumber={vehicle.plateNumber} iconOnly />
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="mb-5 text-xl font-black">Date vehicul</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="VIN" value={vehicle.vin} />
            <Info label="Serie CIV" value={vehicle.civSeries} />
            <Info label="Certificat" value={vehicle.registrationSeries} />
            <Info label="Cilindree" value={vehicle.engineCapacityCc ? `${vehicle.engineCapacityCc} cc` : undefined} />
            <Info label="Putere" value={vehicle.powerKw ? `${vehicle.powerKw} kW${hp ? ` / ${hp} CP` : ""}` : undefined} />
            <Info label="Combustibil" value={vehicle.fuelType ? fuelLabels[vehicle.fuelType] : undefined} />
            <Info label="Culoare" value={vehicle.color} />
            <Info label="Masa totala" value={vehicle.totalMassKg ? `${vehicle.totalMassKg} kg` : undefined} />
            <Info label="Locuri" value={vehicle.seats?.toString()} />
            <Info label="An fabricatie" value={vehicle.manufacturingYear?.toString()} />
            <Info label="Pret achizitie" value={vehicle.acquisitionPrice ? formatCurrency(vehicle.acquisitionPrice) : undefined} />
            <Info label="Ultimul kilometraj" value={formatKilometers(latestOdometer)} />
          </div>
          {vehicle.notes ? <p className="mt-5 rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">{vehicle.notes}</p> : null}
        </div>

        <div className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Sumar costuri</h2>
          <div className="text-4xl font-black">{formatCurrency(totalExpenses + documentCosts)}</div>
          <p className="mt-2 text-sm text-muted-foreground">Include cheltuieli si costuri registru.</p>
        </div>
      </section>

      <section className="mt-7 grid gap-7 xl:grid-cols-2">
        <div className="panel p-5">
          <details className="mb-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><ClipboardList className="size-5 text-primary" /> Registru</h2>
              <span className="btn-secondary h-9 px-3">
                <Plus className="size-4" />
                Adauga intrare
              </span>
            </summary>
            <form action={addVehicleDocument.bind(null, vehicle.id)} className="mt-4 grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[140px_140px_90px_120px_44px]">
              <label>
                <span className="label">Registru</span>
                <select className="field" name="type" required>
                  {Object.values(DocumentType)
                    .filter((type) => registryTypes.includes(type))
                    .map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Data</span>
                <input className="field" name="issuedAt" type="date" required />
              </label>
              <label>
                <span className="label">Luni</span>
                <input className="field" name="validityMonths" type="number" min="1" defaultValue={12} required />
              </label>
              <label>
                <span className="label">Cost lei</span>
                <input className="field" name="cost" placeholder="Optional" />
              </label>
              <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
            </form>
          </details>

          <div className="grid gap-3">
            {documents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nu exista nicio intrare in registru.
              </div>
            ) : null}
            {documents.map((doc) => (
              <div key={doc.id} className="group relative rounded-md border border-border bg-muted/20 p-3 pr-24">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <RegistryIcon type={doc.type} />
                    <div className="min-w-0 text-sm">
                      <span className="font-bold">{documentLabels[doc.type]}</span>
                      <span className="px-2 text-muted-foreground">-</span>
                      <span className="text-muted-foreground">{expiresIn(doc.validUntil)}</span>
                      {doc.cost ? (
                        <>
                          <span className="px-2 text-muted-foreground">-</span>
                          <span className="font-semibold">{formatLei(doc.cost)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <details className="relative">
                      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                        <Pencil className="size-4" />
                      </summary>
                      <form action={updateVehicleDocument.bind(null, doc.id)} className="absolute right-0 z-20 mt-2 grid w-[min(620px,calc(100vw-2rem))] gap-3 rounded-lg border border-border bg-card p-4 shadow-xl md:grid-cols-[140px_140px_90px_120px_44px]">
                        <label>
                          <span className="label">Registru</span>
                          <select className="field" name="type" defaultValue={doc.type} required>
                            {Object.values(DocumentType)
                              .filter((type) => registryTypes.includes(type))
                              .map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}
                          </select>
                        </label>
                        <label>
                          <span className="label">Data</span>
                          <input className="field" name="issuedAt" type="date" defaultValue={dateInput(doc.issuedAt)} />
                        </label>
                        <label>
                          <span className="label">Luni</span>
                          <input className="field" name="validityMonths" type="number" min="1" defaultValue={doc.validityMonths ?? ""} />
                        </label>
                        <label>
                          <span className="label">Cost lei</span>
                          <input className="field" name="cost" defaultValue={doc.cost?.toString() ?? ""} />
                        </label>
                        <input type="hidden" name="validUntil" value={dateInput(doc.validUntil)} />
                        <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
                      </form>
                    </details>
                    <form action={deleteVehicleDocument.bind(null, doc.id)}>
                      <button className="flex size-9 items-center justify-center rounded-md border border-rose-500/40 bg-card/90 text-rose-300 shadow-lg backdrop-blur hover:border-rose-400" type="submit" title="Sterge">
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <details className="mb-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><ReceiptText className="size-5 text-accent" /> Cheltuieli</h2>
              <span className="btn-secondary h-9 px-3">
                <Plus className="size-4" />
                Adauga intrare
              </span>
            </summary>
            <form action={addExpense.bind(null, vehicle.id)} className="mt-4 grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[130px_100px_130px_100px_44px]">
              <label>
                <span className="label">Cheltuiala</span>
                <select className="field" name="category" required>
                  {Object.values(ExpenseCategory).map((category) => <option key={category} value={category}>{expenseLabels[category]}</option>)}
                </select>
              </label>
              <label>
                <span className="label">Cost lei</span>
                <input className="field" name="amount" required />
              </label>
              <label>
                <span className="label">Data</span>
                <input className="field" name="occurredAt" type="date" required />
              </label>
              <label>
                <span className="label">Kilometraj</span>
                <input className="field" name="odometerKm" type="number" />
              </label>
              <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
              <textarea className="field min-h-16 md:col-span-5" name="notes" placeholder="Nota optionala" />
            </form>
          </details>
          <div className="mb-5 divide-y divide-border">
            {vehicle.expenses.map((expense) => (
              <div key={expense.id} className="group relative flex items-center justify-between gap-3 py-3 pr-24 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <ExpenseIcon category={expense.category} note={expense.notes} />
                  <div className="min-w-0">
                    <span className="font-bold">{expenseLabels[expense.category]}</span>
                    <span className="px-2 text-muted-foreground">-</span>
                    <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                    <span className="px-2 text-muted-foreground">-</span>
                    <span className="text-muted-foreground">{formatDate(expense.occurredAt)}</span>
                    {expense.odometerKm ? <span className="text-muted-foreground"> - {expense.odometerKm} km</span> : null}
                  </div>
                </div>
                <div className="absolute bottom-2 right-0 flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <details className="relative">
                    <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                      <Pencil className="size-4" />
                    </summary>
                    <form action={updateExpense.bind(null, expense.id)} className="absolute right-0 z-20 mt-2 grid w-[min(560px,calc(100vw-2rem))] gap-3 rounded-lg border border-border bg-card p-4 shadow-xl md:grid-cols-[130px_100px_130px_100px_44px]">
                      <label>
                        <span className="label">Cheltuiala</span>
                        <select className="field" name="category" defaultValue={expense.category} required>
                          {Object.values(ExpenseCategory).map((category) => <option key={category} value={category}>{expenseLabels[category]}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="label">Cost lei</span>
                        <input className="field" name="amount" defaultValue={expense.amount.toString()} required />
                      </label>
                      <label>
                        <span className="label">Data</span>
                        <input className="field" name="occurredAt" type="date" defaultValue={dateInput(expense.occurredAt)} required />
                      </label>
                      <label>
                        <span className="label">Kilometraj</span>
                        <input className="field" name="odometerKm" type="number" defaultValue={expense.odometerKm ?? ""} />
                      </label>
                      <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
                      <textarea className="field min-h-16 md:col-span-5" name="notes" defaultValue={expense.notes ?? ""} placeholder="Nota optionala" />
                    </form>
                  </details>
                  <form action={deleteExpense.bind(null, expense.id)}>
                    <button className="flex size-9 items-center justify-center rounded-md border border-rose-500/40 bg-card/90 text-rose-300 shadow-lg backdrop-blur hover:border-rose-400" type="submit" title="Sterge">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel mt-7 p-5">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-xl font-black"><CreditCard className="size-5 text-primary" /> Rate</h2>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
            Configureaza planuri de plata recurente pentru credit masina, CASCO, RCA, leasing sau alte obligatii. Aplicatia genereaza calendarul ratelor si actualizeaza automat urmatoarea plata, ratele ramase si valoarea ramasa.
          </p>
        </div>

        <div className="mb-5 grid gap-3">
          {vehicle.paymentPlans.map((plan) => {
            const summary = paymentPlanSummary(plan);
            const nextInstallment = summary.nextInstallment;

            return (
              <div key={plan.id} className="group relative rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <PaymentPlanIcon category={plan.category} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold">{plan.name}</span>
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{paymentPlanCategoryLabels[plan.category]}</span>
                        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{paymentPlanStatusLabels[summary.status]}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
                        <span>Total {formatMoney(plan.totalAmount, plan.currency)}</span>
                        <span>-</span>
                        <span>Rata {formatMoney(plan.installmentAmount, plan.currency)}</span>
                        <span>-</span>
                        <span>{summary.paidCount}/{summary.payableCount} platite</span>
                        <span>-</span>
                        <span>Rest {formatMoney(summary.remainingAmount, plan.currency)}</span>
                        {nextInstallment ? (
                          <>
                            <span>-</span>
                            <span>Urmatoarea {formatDate(nextInstallment.dueDate)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 z-10 flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <details className="relative">
                      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                        <Pencil className="size-4" />
                      </summary>
                      <form action={updatePaymentPlan.bind(null, plan.id)} className="absolute right-0 z-20 mt-2 grid w-[min(760px,calc(100vw-2rem))] gap-3 rounded-lg border border-border bg-card p-4 shadow-xl md:grid-cols-[1fr_140px_120px_90px_110px_130px_90px_44px]">
                        <label><span className="label">Nume</span><input className="field" name="name" defaultValue={plan.name} required /></label>
                        <label>
                          <span className="label">Tip plata</span>
                          <select className="field" name="category" defaultValue={plan.category} required>
                            {Object.values(PaymentPlanCategory).map((category) => <option key={category} value={category}>{paymentPlanCategoryLabels[category]}</option>)}
                          </select>
                        </label>
                        <label><span className="label">Total</span><input className="field" name="totalAmount" defaultValue={plan.totalAmount.toString()} required /></label>
                        <label><span className="label">Rate</span><input className="field" name="totalInstallments" type="number" min="1" defaultValue={plan.totalInstallments} required /></label>
                        <label><span className="label">Rata</span><input className="field" name="installmentAmount" defaultValue={plan.installmentAmount.toString()} required /></label>
                        <label>
                          <span className="label">Frecventa</span>
                          <select className="field" name="frequency" defaultValue={plan.frequency}>
                            {Object.values(PaymentFrequency).map((frequency) => <option key={frequency} value={frequency}>{paymentFrequencyLabels[frequency]}</option>)}
                          </select>
                        </label>
                        <label>
                          <span className="label">Moneda</span>
                          <select className="field" name="currency" defaultValue={plan.currency}>
                            <option value="RON">RON</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </label>
                        <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
                        <label><span className="label">Prima plata</span><input className="field" name="firstPaymentDate" type="date" defaultValue={dateInput(plan.firstPaymentDate)} required /></label>
                        <label>
                          <span className="label">Status</span>
                          <select className="field" name="status" defaultValue={plan.status}>
                            {Object.values(PaymentPlanStatus).map((status) => <option key={status} value={status}>{paymentPlanStatusLabels[status]}</option>)}
                          </select>
                        </label>
                        <label><span className="label">Notificare</span><input className="field" name="reminderDays" type="number" min="0" defaultValue={plan.reminderDays} /></label>
                        <label className="md:col-span-4"><span className="label">Note</span><input className="field" name="notes" defaultValue={plan.notes ?? ""} /></label>
                      </form>
                    </details>
                    <form action={deletePaymentPlan.bind(null, plan.id)}>
                      <button className="flex size-9 items-center justify-center rounded-md border border-rose-500/40 bg-card/90 text-rose-300 shadow-lg backdrop-blur hover:border-rose-400" type="submit" title="Sterge plan">
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Rata</th>
                        <th className="px-3 py-2">Scadenta</th>
                        <th className="px-3 py-2">Valoare</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Platita la</th>
                        <th className="px-3 py-2 text-right">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {plan.installments.map((installment) => {
                        const displayStatus = installmentDisplayStatus(installment, summary.nextInstallment?.id);

                        return (
                        <tr key={installment.id} className="group/installment">
                            <td className="px-3 py-2 font-semibold">{installment.installmentNumber}</td>
                            <td className="px-3 py-2">{formatDate(installment.dueDate)}</td>
                            <td className="px-3 py-2">{formatMoney(installment.amount, installment.currency)}</td>
                            <td className="px-3 py-2">{displayStatus}</td>
                            <td className="px-3 py-2 text-muted-foreground">{installment.paidDate ? formatDate(installment.paidDate) : "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-2 opacity-0 transition group-hover/installment:opacity-100">
                                {installment.status === PaymentInstallmentStatus.PAID ? (
                                  <form action={markInstallmentUnpaid.bind(null, installment.id)}>
                                    <button className="flex size-8 items-center justify-center rounded-md border border-border bg-card/90 shadow-sm hover:border-primary" type="submit" title="Marcheaza neplatita"><RotateCcw className="size-4" /></button>
                                  </form>
                                ) : (
                                  <form action={markInstallmentPaid.bind(null, installment.id)}>
                                    <button className="flex size-8 items-center justify-center rounded-md border border-border bg-card/90 shadow-sm hover:border-primary" type="submit" title="Marcheaza platita"><Check className="size-4" /></button>
                                  </form>
                                )}
                                <details className="relative">
                                  <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-card/90 shadow-sm hover:border-primary" title="Editeaza rata">
                                    <Pencil className="size-4" />
                                  </summary>
                                  <form action={updatePaymentInstallment.bind(null, installment.id)} className="absolute right-0 z-20 mt-2 grid w-[min(520px,calc(100vw-2rem))] gap-3 rounded-lg border border-border bg-card p-4 shadow-xl md:grid-cols-[120px_110px_130px_120px_44px]">
                                    <label><span className="label">Scadenta</span><input className="field" name="dueDate" type="date" defaultValue={dateInput(installment.dueDate)} required /></label>
                                    <label><span className="label">Valoare</span><input className="field" name="amount" defaultValue={installment.amount.toString()} required /></label>
                                    <label>
                                      <span className="label">Status</span>
                                      <select className="field" name="status" defaultValue={installment.status}>
                                        {Object.values(PaymentInstallmentStatus).map((status) => <option key={status} value={status}>{paymentInstallmentStatusLabels[status]}</option>)}
                                      </select>
                                    </label>
                                    <label><span className="label">Platita la</span><input className="field" name="paidDate" type="date" defaultValue={dateInput(installment.paidDate)} /></label>
                                    <button className="btn size-11 self-end px-0" type="submit" title="Salveaza"><Save className="size-6" /></button>
                                    <label className="md:col-span-5"><span className="label">Note</span><input className="field" name="notes" defaultValue={installment.notes ?? ""} /></label>
                                  </form>
                                </details>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {vehicle.paymentPlans.length === 0 ? <div className="text-sm text-muted-foreground">Nu exista planuri de plata adaugate.</div> : null}
        </div>

        <details>
          <summary className="btn-secondary h-9 cursor-pointer list-none px-3">
            <Plus className="size-4" />
            Adauga plan de plata
          </summary>
          <form action={createPaymentPlan.bind(null, vehicle.id)} className="mt-4 grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-[1fr_150px_120px_90px_110px_130px_90px_44px]">
            <label><span className="label">Nume</span><input className="field" name="name" placeholder="Plan plata 2026" required /></label>
            <label>
              <span className="label">Tip plata</span>
              <select className="field" name="category" defaultValue={PaymentPlanCategory.CASCO} required>
                {Object.values(PaymentPlanCategory).map((category) => <option key={category} value={category}>{paymentPlanCategoryLabels[category]}</option>)}
              </select>
            </label>
            <label><span className="label">Total</span><input className="field" name="totalAmount" required /></label>
            <label><span className="label">Rate</span><input className="field" name="totalInstallments" type="number" min="1" defaultValue={12} required /></label>
            <label><span className="label">Rata</span><input className="field" name="installmentAmount" placeholder="Auto" /></label>
            <label>
              <span className="label">Frecventa</span>
              <select className="field" name="frequency" defaultValue={PaymentFrequency.MONTHLY}>
                {Object.values(PaymentFrequency).map((frequency) => <option key={frequency} value={frequency}>{paymentFrequencyLabels[frequency]}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Moneda</span>
              <select className="field" name="currency" defaultValue="RON">
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <button className="btn size-11 self-end px-0" type="submit" title="Adauga"><Plus className="size-6" /></button>
            <label><span className="label">Prima plata</span><input className="field" name="firstPaymentDate" type="date" required /></label>
            <label><span className="label">Notificare</span><input className="field" name="reminderDays" type="number" min="0" defaultValue={7} /></label>
            <label className="md:col-span-5"><span className="label">Note</span><input className="field" name="notes" /></label>
          </form>
        </details>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 rounded-md border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right">{value ?? "N/A"}</strong>
    </div>
  );
}

function driverInitials(driver: { firstName: string; lastName: string } | null) {
  if (!driver) return "NA";
  return `${driver.firstName[0] ?? ""}${driver.lastName[0] ?? ""}`.toUpperCase();
}

function dateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function expiresIn(date: Date) {
  const relative = relativeDue(date);
  if (relative.startsWith("expirat")) return relative;
  return `expira ${relative.replace(/^peste /, "in ")}`;
}

function RegistryIcon({ type }: { type: DocumentType }) {
  const iconClass = "size-5";
  const wrapperClass = "flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary";

  if (type === DocumentType.RCA) {
    return <span className={wrapperClass}><FileCheck className={iconClass} /></span>;
  }

  if (type === DocumentType.CASCO) {
    return <span className={wrapperClass}><FileCheck2 className={iconClass} /></span>;
  }

  if (type === DocumentType.FIRE_EXTINGUISHER) {
    return <span className={wrapperClass}><FireExtinguisher className={iconClass} /></span>;
  }

  if (type === DocumentType.ROVINIETA) {
    return <span className={wrapperClass}><CarTaxiFront className={iconClass} /></span>;
  }

  if (type === DocumentType.ITP) {
    return <span className={wrapperClass}><FileSearch2 className={iconClass} /></span>;
  }

  if (type === DocumentType.FIRST_AID_KIT) {
    return <span className={wrapperClass}><BriefcaseMedical className={iconClass} /></span>;
  }

  return <span className={wrapperClass}><ClipboardList className={iconClass} /></span>;
}

function ExpenseIcon({ category, note }: { category: ExpenseCategory; note?: string | null }) {
  const iconClass = "size-5";
  const wrapperClass = "flex size-10 items-center justify-center rounded-md bg-accent/15 text-accent";
  const title = note || undefined;

  if (category === ExpenseCategory.FUEL) {
    return <span className={wrapperClass} title={title}><Fuel className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.CHARGING) {
    return <span className={wrapperClass} title={title}><PlugZap className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.SERVICE) {
    return <span className={wrapperClass} title={title}><Wrench className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.REPAIR) {
    return <span className={wrapperClass} title={title}><Hammer className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.CAR_WASH) {
    return <span className={wrapperClass} title={title}><Bubbles className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.PARKING) {
    return <span className={wrapperClass} title={title}><SquareParking className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.ACCESSORIES) {
    return <span className={wrapperClass} title={title}><Box className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.SUBSCRIPTION) {
    return <span className={wrapperClass} title={title}><Wifi className={iconClass} /></span>;
  }

  if (category === ExpenseCategory.OTHER) {
    return <span className={wrapperClass} title={title}><BadgeEuro className={iconClass} /></span>;
  }

  return <span className={wrapperClass} title={title}><ReceiptText className={iconClass} /></span>;
}

function PaymentPlanIcon({ category }: { category: PaymentPlanCategory }) {
  const wrapperClass = "flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary";

  if (category === PaymentPlanCategory.CASCO) {
    return <span className={wrapperClass}><FileCheck2 className="size-5" /></span>;
  }

  if (category === PaymentPlanCategory.RCA) {
    return <span className={wrapperClass}><FileCheck className="size-5" /></span>;
  }

  if (category === PaymentPlanCategory.LEASING) {
    return <span className={wrapperClass}><Car className="size-5" /></span>;
  }

  if (category === PaymentPlanCategory.SUBSCRIPTION) {
    return <span className={wrapperClass}><Wifi className="size-5" /></span>;
  }

  if (category === PaymentPlanCategory.EXTENDED_WARRANTY) {
    return <span className={wrapperClass}><ClipboardList className="size-5" /></span>;
  }

  if (category === PaymentPlanCategory.OTHER) {
    return <span className={wrapperClass}><BadgeEuro className="size-5" /></span>;
  }

  return <span className={wrapperClass}><CreditCard className="size-5" /></span>;
}

function paymentPlanSummary(plan: {
  status: PaymentPlanStatus;
  installments: Array<{ id: string; status: PaymentInstallmentStatus; amount: unknown; dueDate: Date }>;
}) {
  const payable = plan.installments.filter((installment) => installment.status !== PaymentInstallmentStatus.CANCELLED);
  const paid = payable.filter((installment) => installment.status === PaymentInstallmentStatus.PAID);
  const unpaid = payable.filter((installment) => installment.status !== PaymentInstallmentStatus.PAID);
  const nextInstallment = unpaid.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
  const remainingAmount = unpaid.reduce((sum, installment) => sum + Number(installment.amount ?? 0), 0);
  const completed = payable.length > 0 && paid.length === payable.length;

  return {
    paidCount: paid.length,
    payableCount: payable.length,
    remainingAmount,
    nextInstallment,
    status: plan.status === PaymentPlanStatus.CANCELLED ? PaymentPlanStatus.CANCELLED : completed ? PaymentPlanStatus.COMPLETED : PaymentPlanStatus.ACTIVE
  };
}

function installmentDisplayStatus(installment: { id: string; status: PaymentInstallmentStatus; dueDate: Date }, nextInstallmentId?: string) {
  if (installment.status === PaymentInstallmentStatus.CANCELLED) return "Anulata";
  if (installment.status === PaymentInstallmentStatus.PAID) return "Platita";
  if (installment.dueDate < startOfToday()) return "Intarziata";
  if (installment.id === nextInstallmentId) return "Urmatoare";
  return "Neplatita";
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatMoney(value: unknown, currency = "RON") {
  return `${Number(value ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} ${currency}`;
}

function formatLei(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: 0 })} lei`;
}
