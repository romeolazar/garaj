import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Car, Pencil, Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteVehicle } from "@/app/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { DeleteVehicleButton } from "@/components/delete-vehicle-button";
import { documentLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const vehicleWhere = session.user.role === "ADMIN" ? {} : { driverId: session.user.id };

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere,
    orderBy: { createdAt: "desc" },
    include: { documents: { orderBy: { validUntil: "asc" } }, expenses: true }
  });

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black">Vehicule</h1>
          <p className="mt-2 text-muted-foreground">Administrare flota, registru si costuri.</p>
        </div>
        {session.user.role === "ADMIN" ? <Link className="btn" href="/vehicles/new"><Plus className="size-4" /> Adauga vehicul</Link> : null}
      </div>
      {vehicles.length === 0 && session.user.role !== "ADMIN" ? (
        <div className="panel flex min-h-44 flex-col items-center justify-center p-5 text-muted-foreground">
          <Car className="mb-4 size-10 opacity-40" />
          Nu aveti o masina alocata in garaj.
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => {
          const docsTotal = vehicle.documents.reduce((sum, item) => sum + Number(item.cost ?? 0), 0);
          const total = vehicle.expenses.reduce((sum, item) => sum + Number(item.amount), 0) + docsTotal;
          const nextDoc = vehicle.documents[0];
          return (
            <div key={vehicle.id} className="panel group relative p-5 transition hover:border-primary">
              <Link href={`/vehicles/${vehicle.id}`} className="block">
                <div className="mb-5 flex items-center gap-3">
                  {vehicle.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vehicle.imageUrl} alt="" className="size-11 rounded-md border border-border object-contain bg-white p-1" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Car className="size-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-xl font-black">{vehicle.plateNumber}</div>
                    <div className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model}</div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Urmatorul registru</span><strong>{nextDoc ? `${documentLabels[nextDoc.type]} - ${formatDate(nextDoc.validUntil)}` : "N/A"}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Costuri</span><strong>{formatCurrency(total)}</strong></div>
                </div>
              </Link>
              <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
                <Link href={`/vehicles/${vehicle.id}/edit`} className="flex size-9 items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                  <Pencil className="size-4" />
                </Link>
                {session.user.role === "ADMIN" ? <DeleteVehicleButton action={deleteVehicle.bind(null, vehicle.id)} plateNumber={vehicle.plateNumber} iconOnly /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
