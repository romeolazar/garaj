import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FuelType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVehicle } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { fuelLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const drivers = await prisma.user.findMany({ orderBy: { firstName: "asc" } });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-4xl font-black">Adauga vehicul</h1>
        <p className="mt-2 text-muted-foreground">Date tehnice, registru si mementouri automate.</p>
      </div>
      <form action={createVehicle} className="grid gap-7">
        <section className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Identificare</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className="label">Nr. inmatriculare</span><input className="field" name="plateNumber" required /></label>
            <label><span className="label">Marca</span><input className="field" name="make" required /></label>
            <label><span className="label">Model</span><input className="field" name="model" required /></label>
            <label><span className="label">Nr. identificare/VIN</span><input className="field" name="vin" /></label>
            <label><span className="label">Serie CIV</span><input className="field" name="civSeries" /></label>
            <label><span className="label">Certificat inmatriculare</span><input className="field" name="registrationSeries" /></label>
            <label><span className="label">Logo / imagine URL</span><input className="field" name="imageUrl" placeholder="https://..." /></label>
            <label className="md:col-span-2"><span className="label">Imagine banner URL</span><input className="field" name="backgroundImageUrl" placeholder="https://images.unsplash.com/..." /></label>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Date tehnice</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <label><span className="label">Cilindree</span><input className="field" name="engineCapacityCc" type="number" /></label>
            <label><span className="label">Putere kW</span><input className="field" name="powerKw" type="number" /></label>
            <label><span className="label">Culoare</span><input className="field" name="color" /></label>
            <label><span className="label">Masa totala kg</span><input className="field" name="totalMassKg" type="number" /></label>
            <label>
              <span className="label">Combustibil</span>
              <select className="field" name="fuelType" defaultValue="">
                <option value="">Selecteaza</option>
                {Object.values(FuelType).map((fuel) => <option key={fuel} value={fuel}>{fuelLabels[fuel]}</option>)}
              </select>
            </label>
            <label><span className="label">Nr. locuri</span><input className="field" name="seats" type="number" /></label>
            <label><span className="label">An fabricatie</span><input className="field" name="manufacturingYear" type="number" /></label>
            <label><span className="label">Pret achizitie</span><input className="field" name="acquisitionPrice" inputMode="decimal" /></label>
            <label>
              <span className="label">Șofer alocat</span>
              <select className="field" name="driverId" defaultValue="">
                <option value="">Fara șofer</option>
                {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</option>)}
              </select>
            </label>
            <label><span className="label">Garantie pana la</span><input className="field" name="warrantyUntil" type="date" /></label>
          </div>
          <label className="mt-4 block"><span className="label">Note</span><textarea className="field min-h-28" name="notes" /></label>
        </section>

        <section className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Registru initial</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <DocumentDateCost dateName="itpUntil" costName="itpCost" label="ITP" />
            <DocumentDateCost dateName="rcaUntil" costName="rcaCost" label="RCA" />
            <DocumentDateCost dateName="cascoUntil" costName="cascoCost" label="CASCO" />
            <DocumentDateCost dateName="rovinietaUntil" costName="rovinietaCost" label="Rovinieta" />
            <DocumentDateCost dateName="firstAidKitUntil" costName="firstAidKitCost" label="Trusa medicala" />
            <DocumentDateCost dateName="fireExtinguisherUntil" costName="fireExtinguisherCost" label="Extinctor" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Se creeaza automat remindere la 30, 7, 3 si 1 zi inainte.</p>
        </section>

        <div className="flex justify-end">
          <button className="btn" type="submit">Salveaza vehicul</button>
        </div>
      </form>
    </AppShell>
  );
}

function DocumentDateCost({ label, dateName, costName }: { label: string; dateName: string; costName: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <label><span className="label">{label} valabil pana la</span><input className="field" name={dateName} type="date" /></label>
      <label><span className="label">Cost {label}</span><input className="field" name={costName} placeholder="Optional" /></label>
    </div>
  );
}
