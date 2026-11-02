import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  addCostForVehicle,
  addTireSet,
  addVehicleDocument,
  createPaymentPlan,
  deleteExpense,
  deletePaymentPlan,
  deleteServiceRecord,
  deleteTireSet,
  deleteVehicleDocument,
  updateExpense,
  updatePaymentInstallment,
  updatePaymentPlan,
  updateServiceRecord,
  updateTireSet,
  updateVehicleDocument
} from "@/app/actions";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Modal, ModalFooter } from "@/components/ui/modal";
import type { CostCategory } from "@/lib/cost-categories";
import { dateInput, documentLabel, expenseCategoryKey, type GarageVehicle } from "@/lib/garage";
import { paymentFrequencyLabels, paymentInstallmentStatusLabels, paymentPlanCategoryLabels, paymentPlanStatusLabels, tireTypeLabels } from "@/lib/labels";

type Expense = GarageVehicle["expenses"][number];
type Service = GarageVehicle["services"][number];
type Doc = GarageVehicle["documents"][number];
type Tire = GarageVehicle["tires"][number];
type Plan = GarageVehicle["paymentPlans"][number];
type Installment = Plan["installments"][number];

const today = () => dateInput(new Date());
const editIcon = <Pencil className="i" style={{ width: 14, height: 14 }} />;
const deleteIcon = <Trash2 className="i" style={{ width: 14, height: 14 }} />;

function VehicleSelect({ vehicles, selected }: { vehicles: GarageVehicle[]; selected?: string }) {
  if (vehicles.length === 1) return <input type="hidden" name="vehicleId" value={vehicles[0].id} />;
  return (
    <label className="full">
      Mașină
      <select className="field" name="vehicleId" defaultValue={selected && selected !== "all" ? selected : vehicles[0]?.id} required>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plateNumber}</option>)}
      </select>
    </label>
  );
}

function CostFields({ categories, defaultKey = "other", defaults }: { categories: CostCategory[]; defaultKey?: string; defaults?: { amount?: string; date?: string; km?: number | null; nextKm?: number | null; notes?: string | null; quantity?: number | null; unitPrice?: string | null; station?: string | null } }) {
  const active = categories.filter((c) => c.isActive || c.key === defaultKey);
  return (
    <>
      <label className="full">
        Categorie
        <select className="field" name="costCategory" defaultValue={defaultKey}>
          {active.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
      </label>
      <label>Sumă (RON)<input className="field" name="amount" inputMode="decimal" defaultValue={defaults?.amount ?? ""} required /></label>
      <label>Data<input className="field" name="occurredAt" type="date" defaultValue={defaults?.date ?? today()} required /></label>
      <label>Kilometraj<input className="field" name="odometerKm" type="number" defaultValue={defaults?.km ?? ""} /></label>
      <label>Următoarea revizie la km<input className="field" name="nextServiceAtKm" type="number" defaultValue={defaults?.nextKm ?? ""} placeholder="doar pentru revizii" /></label>
      {defaults?.quantity ? (
        <>
          <label>Cantitate<input className="field" name="quantity" inputMode="decimal" defaultValue={defaults.quantity} /></label>
          <label>Preț / unitate<input className="field" name="unitPrice" inputMode="decimal" defaultValue={defaults.unitPrice ?? ""} /></label>
          <label className="full">Stație<input className="field" name="station" defaultValue={defaults.station ?? ""} /></label>
        </>
      ) : null}
      <label className="full">Notă<input className="field" name="notes" defaultValue={defaults?.notes ?? ""} /></label>
    </>
  );
}

export function AddCostModal({ vehicles, selected, categories, returnTab = "costs", label = "Adaugă cost", triggerClassName = "btn" }: { vehicles: GarageVehicle[]; selected: string; categories: CostCategory[]; returnTab?: string; label?: string; triggerClassName?: string }) {
  return (
    <Modal trigger={<><Plus className="i" /><span>{label}</span></>} triggerClassName={triggerClassName} title="Adaugă cost" sub="Orice cheltuială: revizie, parcare, amendă, accesoriu…">
      <form action={addCostForVehicle}>
        <input type="hidden" name="returnTab" value={returnTab} />
        <div className="form">
          <VehicleSelect vehicles={vehicles} selected={selected} />
          <CostFields categories={categories} />
        </div>
        <ModalFooter />
      </form>
    </Modal>
  );
}

export function ExpenseActions({ expense, categories, returnTab = "costs" }: { expense: Expense; categories: CostCategory[]; returnTab?: string }) {
  return (
    <div className="row-actions">
      <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title="Editează costul">
        <form action={updateExpense.bind(null, expense.id)}>
          <input type="hidden" name="returnTab" value={returnTab} />
          <div className="form">
            <CostFields
              categories={categories.filter((c) => c.key !== "service")}
              defaultKey={expenseCategoryKey(expense, categories)}
              defaults={{ amount: expense.amount.toString(), date: dateInput(expense.occurredAt), km: expense.odometerKm, notes: expense.notes, quantity: expense.quantity, unitPrice: expense.unitPrice?.toString() ?? null, station: expense.station }}
            />
          </div>
          <ModalFooter />
        </form>
      </Modal>
      <ConfirmForm action={deleteExpense.bind(null, expense.id)} message="Ștergi acest cost?" title="Șterge">{deleteIcon}</ConfirmForm>
    </div>
  );
}

export function ServiceActions({ service }: { service: Service }) {
  return (
    <div className="row-actions">
      <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title="Editează revizia">
        <form action={updateServiceRecord.bind(null, service.id)}>
          <div className="form">
            <label>Data<input className="field" name="servicedAt" type="date" defaultValue={dateInput(service.servicedAt)} required /></label>
            <label>Cost (RON)<input className="field" name="cost" inputMode="decimal" defaultValue={service.cost.toString()} required /></label>
            <label>Kilometraj<input className="field" name="odometerKm" type="number" defaultValue={service.odometerKm ?? ""} /></label>
            <label>Următoarea revizie la km<input className="field" name="nextServiceAtKm" type="number" defaultValue={service.nextServiceAtKm ?? ""} /></label>
            <label className="full">Lucrări<textarea className="field" name="notes" defaultValue={service.notes ?? ""} /></label>
          </div>
          <ModalFooter />
        </form>
      </Modal>
      <ConfirmForm action={deleteServiceRecord.bind(null, service.id)} message="Ștergi această revizie?" title="Șterge">{deleteIcon}</ConfirmForm>
    </div>
  );
}

function DocumentFields({ doc }: { doc?: Doc }) {
  return (
    <>
      <label className="full">
        Tip
        <select className="field" name="type" defaultValue={doc?.type ?? "RCA"} required>
          {(["ITP", "RCA", "CASCO", "ROVINIETA", "FIRST_AID_KIT", "FIRE_EXTINGUISHER", "WARRANTY", "CAR_LOAN", "CASCO_RATE"] as const).map((type) => <option key={type} value={type}>{documentLabel[type]}</option>)}
        </select>
      </label>
      <label>Emis la<input className="field" name="issuedAt" type="date" defaultValue={doc ? dateInput(doc.issuedAt) : today()} /></label>
      <label>Valabilitate (luni)<input className="field" name="validityMonths" type="number" min="1" defaultValue={doc?.validityMonths ?? 12} /></label>
      <label>sau valabil până la<input className="field" name="validUntil" type="date" defaultValue={doc ? dateInput(doc.validUntil) : ""} /></label>
      <label>Cost (RON)<input className="field" name="cost" inputMode="decimal" defaultValue={doc?.cost?.toString() ?? ""} /></label>
      <label className="full">Note<input className="field" name="notes" defaultValue={doc?.notes ?? ""} /></label>
    </>
  );
}

export function AddDocumentModal({ vehicleId }: { vehicleId: string }) {
  return (
    <Modal trigger={<><Plus className="i" />Adaugă document</>} triggerClassName="btn btn-sm" title="Adaugă document" sub="Valabilitatea se calculează din data emiterii și numărul de luni. Generează automat mementourile.">
      <form action={addVehicleDocument.bind(null, vehicleId)}>
        <div className="form"><DocumentFields /></div>
        <ModalFooter />
      </form>
    </Modal>
  );
}

export function DocumentActions({ doc }: { doc: Doc }) {
  return (
    <div className="row-actions">
      <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title={`Editează ${documentLabel[doc.type]}`}>
        <form action={updateVehicleDocument.bind(null, doc.id)}>
          <div className="form"><DocumentFields doc={doc} /></div>
          <ModalFooter />
        </form>
      </Modal>
      <ConfirmForm action={deleteVehicleDocument.bind(null, doc.id)} message={`Ștergi documentul ${documentLabel[doc.type]}?`} title="Șterge">{deleteIcon}</ConfirmForm>
    </div>
  );
}

export function AddFuelModal({ vehicles, selected }: { vehicles: GarageVehicle[]; selected: string }) {
  const vehicle = vehicles.find((v) => v.id === selected) ?? vehicles[0];
  const electric = vehicle?.fuelType === "ELECTRIC";
  return (
    <Modal trigger={<><Plus className="i" />Adaugă</>} triggerClassName="btn btn-sm" title={electric ? "Adaugă încărcare" : "Adaugă alimentare"} sub="Cu cantitatea și kilometrajul se calculează consumul.">
      <form action={addCostForVehicle}>
        <input type="hidden" name="returnTab" value="fuel" />
        <input type="hidden" name="costCategory" value={electric ? "charging" : "fuel"} />
        <div className="form">
          <VehicleSelect vehicles={[vehicle]} />
          <label>Data<input className="field" name="occurredAt" type="date" defaultValue={today()} required /></label>
          <label>Kilometraj<input className="field" name="odometerKm" type="number" /></label>
          <label>Cantitate ({electric ? "kWh" : "L"})<input className="field" name="quantity" inputMode="decimal" required /></label>
          <label>Preț / unitate (RON)<input className="field" name="unitPrice" inputMode="decimal" /></label>
          <label>Total plătit (RON)<input className="field" name="amount" inputMode="decimal" placeholder="calculat dacă lipsește" /></label>
          <label>Stație<input className="field" name="station" /></label>
        </div>
        <ModalFooter />
      </form>
    </Modal>
  );
}

function TireFields({ tire }: { tire?: Tire }) {
  return (
    <>
      <label>
        Tip
        <select className="field" name="type" defaultValue={tire?.type ?? "SUMMER"}>
          {(["SUMMER", "WINTER", "ALL_SEASON"] as const).map((type) => <option key={type} value={type}>{tireTypeLabels[type]}</option>)}
        </select>
      </label>
      <label>Dimensiune<input className="field" name="size" defaultValue={tire?.size ?? ""} placeholder="205/55 R16" required /></label>
      <label>Marcă<input className="field" name="brand" defaultValue={tire?.brand ?? ""} required /></label>
      <label>Model<input className="field" name="model" defaultValue={tire?.model ?? ""} /></label>
      <label>Data cumpărării<input className="field" name="purchasedAt" type="date" defaultValue={tire ? dateInput(tire.purchasedAt) : today()} required /></label>
      <label>Cost (RON)<input className="field" name="cost" inputMode="decimal" defaultValue={tire?.cost?.toString() ?? ""} /></label>
      <label className="full">Note<input className="field" name="notes" defaultValue={tire?.notes ?? ""} placeholder="DOT, stare, unde au fost cumpărate" /></label>
    </>
  );
}

export function AddTireModal({ vehicleId }: { vehicleId: string }) {
  return (
    <Modal trigger={<><Plus className="i" />Adaugă set</>} triggerClassName="btn btn-sm" title="Adaugă set de anvelope">
      <form action={addTireSet.bind(null, vehicleId)}>
        <div className="form"><TireFields /></div>
        <ModalFooter />
      </form>
    </Modal>
  );
}

export function TireActions({ tire }: { tire: Tire }) {
  return (
    <div className="row-actions">
      <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title="Editează anvelopele">
        <form action={updateTireSet.bind(null, tire.id)}>
          <div className="form"><TireFields tire={tire} /></div>
          <ModalFooter />
        </form>
      </Modal>
      <ConfirmForm action={deleteTireSet.bind(null, tire.id)} message="Ștergi acest set de anvelope?" title="Șterge">{deleteIcon}</ConfirmForm>
    </div>
  );
}

function PlanFields({ plan }: { plan?: Plan }) {
  return (
    <>
      <label className="full">Nume<input className="field" name="name" defaultValue={plan?.name ?? ""} placeholder="ex. CASCO 2026 în rate" required /></label>
      <label>
        Tip
        <select className="field" name="category" defaultValue={plan?.category ?? "CASCO"}>
          {Object.entries(paymentPlanCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Frecvență
        <select className="field" name="frequency" defaultValue={plan?.frequency ?? "MONTHLY"}>
          {Object.entries(paymentFrequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Total (RON)<input className="field" name="totalAmount" inputMode="decimal" defaultValue={plan?.totalAmount.toString() ?? ""} required /></label>
      <label>Număr rate<input className="field" name="totalInstallments" type="number" min="1" defaultValue={plan?.totalInstallments ?? 12} required /></label>
      <label>Valoare rată<input className="field" name="installmentAmount" inputMode="decimal" defaultValue={plan?.installmentAmount.toString() ?? ""} placeholder="automat" /></label>
      <label>Prima plată<input className="field" name="firstPaymentDate" type="date" defaultValue={plan ? dateInput(plan.firstPaymentDate) : today()} required /></label>
      <label>Memento (zile înainte)<input className="field" name="reminderDays" type="number" min="0" defaultValue={plan?.reminderDays ?? 7} /></label>
      {plan ? (
        <label>
          Stare
          <select className="field" name="status" defaultValue={plan.status}>
            {Object.entries(paymentPlanStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}
      <input type="hidden" name="currency" value={plan?.currency ?? "RON"} />
      <label className="full">Note<input className="field" name="notes" defaultValue={plan?.notes ?? ""} /></label>
    </>
  );
}

export function AddPlanModal({ vehicleId }: { vehicleId: string }) {
  return (
    <Modal trigger={<><Plus className="i" />Plan de rate</>} triggerClassName="btn-secondary btn-sm" title="Adaugă plan de rate" sub="Credit, leasing, CASCO sau RCA plătite în rate. Ratele se generează automat.">
      <form action={createPaymentPlan.bind(null, vehicleId)}>
        <div className="form"><PlanFields /></div>
        <ModalFooter />
      </form>
    </Modal>
  );
}

export function PlanActions({ plan }: { plan: Plan }) {
  return (
    <div className="row-actions">
      <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title="Editează planul de rate">
        <form action={updatePaymentPlan.bind(null, plan.id)}>
          <div className="form"><PlanFields plan={plan} /></div>
          <ModalFooter />
        </form>
      </Modal>
      <ConfirmForm action={deletePaymentPlan.bind(null, plan.id)} message={`Ștergi planul „${plan.name}” cu toate ratele?`} title="Șterge">{deleteIcon}</ConfirmForm>
    </div>
  );
}

export function InstallmentEdit({ installment }: { installment: Installment }) {
  return (
    <Modal trigger={editIcon} triggerClassName="icon-sm" triggerTitle="Editează" title={`Rata ${installment.installmentNumber}`}>
      <form action={updatePaymentInstallment.bind(null, installment.id)}>
        <div className="form">
          <label>Scadență<input className="field" name="dueDate" type="date" defaultValue={dateInput(installment.dueDate)} required /></label>
          <label>Valoare<input className="field" name="amount" inputMode="decimal" defaultValue={installment.amount.toString()} required /></label>
          <label>
            Stare
            <select className="field" name="status" defaultValue={installment.status}>
              {Object.entries(paymentInstallmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Plătită la<input className="field" name="paidDate" type="date" defaultValue={dateInput(installment.paidDate)} /></label>
          <label className="full">Note<input className="field" name="notes" defaultValue={installment.notes ?? ""} /></label>
        </div>
        <ModalFooter />
      </form>
    </Modal>
  );
}
