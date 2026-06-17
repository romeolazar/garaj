import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FuelType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateVehicle } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { fuelLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;

  const [vehicle, drivers] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id } }),
    prisma.user.findMany({ orderBy: { firstName: "asc" } })
  ]);

  if (!vehicle) notFound();
  if (session.user.role !== "ADMIN" && vehicle.driverId !== session.user.id) notFound();

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black">Editeaza vehicul</h1>
          <p className="mt-2 text-muted-foreground">{vehicle.plateNumber} - {vehicle.make} {vehicle.model}</p>
        </div>
        <Link href={`/vehicles/${vehicle.id}`} className="btn-secondary">Inapoi la vehicul</Link>
      </div>

      <form action={updateVehicle.bind(null, vehicle.id)} className="grid gap-7">
        <section className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Identificare</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className="label">Nr. inmatriculare</span><input className="field" name="plateNumber" defaultValue={vehicle.plateNumber} required /></label>
            <label><span className="label">Marca</span><input className="field" name="make" defaultValue={vehicle.make} required /></label>
            <label><span className="label">Model</span><input className="field" name="model" defaultValue={vehicle.model} required /></label>
            <label><span className="label">Nr. identificare/VIN</span><input className="field" name="vin" defaultValue={vehicle.vin ?? ""} /></label>
            <label><span className="label">Serie CIV</span><input className="field" name="civSeries" defaultValue={vehicle.civSeries ?? ""} /></label>
            <label><span className="label">Certificat inmatriculare</span><input className="field" name="registrationSeries" defaultValue={vehicle.registrationSeries ?? ""} /></label>
            <label><span className="label">Logo / imagine URL</span><input className="field" name="imageUrl" defaultValue={vehicle.imageUrl ?? ""} placeholder="https://..." /></label>
            <label className="md:col-span-2"><span className="label">Imagine banner URL</span><input className="field" name="backgroundImageUrl" defaultValue={vehicle.backgroundImageUrl ?? ""} placeholder="https://images.unsplash.com/..." /></label>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Date tehnice</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <label><span className="label">Cilindree</span><input className="field" name="engineCapacityCc" type="number" defaultValue={vehicle.engineCapacityCc ?? ""} /></label>
            <label><span className="label">Putere kW</span><input className="field" name="powerKw" type="number" defaultValue={vehicle.powerKw ?? ""} /></label>
            <label><span className="label">Culoare</span><input className="field" name="color" defaultValue={vehicle.color ?? ""} /></label>
            <label><span className="label">Masa totala kg</span><input className="field" name="totalMassKg" type="number" defaultValue={vehicle.totalMassKg ?? ""} /></label>
            <label>
              <span className="label">Combustibil</span>
              <select className="field" name="fuelType" defaultValue={vehicle.fuelType ?? ""}>
                <option value="">Selecteaza</option>
                {Object.values(FuelType).map((fuel) => <option key={fuel} value={fuel}>{fuelLabels[fuel]}</option>)}
              </select>
            </label>
            <label><span className="label">Nr. locuri</span><input className="field" name="seats" type="number" defaultValue={vehicle.seats ?? ""} /></label>
            <label><span className="label">An fabricatie</span><input className="field" name="manufacturingYear" type="number" defaultValue={vehicle.manufacturingYear ?? ""} /></label>
            <label><span className="label">Pret achizitie</span><input className="field" name="acquisitionPrice" inputMode="decimal" defaultValue={vehicle.acquisitionPrice?.toString() ?? ""} /></label>
            {session.user.role === "ADMIN" ? (
              <label>
                <span className="label">Șofer alocat</span>
                <select className="field" name="driverId" defaultValue={vehicle.driverId ?? ""}>
                  <option value="">Fara șofer</option>
                  {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</option>)}
                </select>
              </label>
            ) : null}
            <label><span className="label">Garantie pana la</span><input className="field" name="warrantyUntil" type="date" defaultValue={dateInput(vehicle.warrantyUntil)} /></label>
          </div>
          <label className="mt-4 block"><span className="label">Note</span><textarea className="field min-h-36" name="notes" defaultValue={vehicle.notes ?? ""} /></label>
        </section>

        <div className="flex justify-end gap-3">
          <Link href={`/vehicles/${vehicle.id}`} className="btn-secondary">Anuleaza</Link>
          <button className="btn" type="submit">Salveaza modificarile</button>
        </div>
      </form>
    </AppShell>
  );
}

function dateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
