import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bell, CheckCircle2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { formatDate, relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const alerts = await prisma.reminder.findMany({
    where: { status: "PENDING", notifyAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    include: { vehicle: true, document: true }
  });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-4xl font-black">Alerte</h1>
        <p className="mt-2 text-muted-foreground">Mementouri care necesita atentie acum.</p>
      </div>

      <section className="panel p-5">
        {alerts.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <CheckCircle2 className="mb-4 size-12 text-accent" />
            Nu exista alerte in asteptare.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <Link key={alert.id} href={`/vehicles/${alert.vehicleId}`} className="flex items-center justify-between gap-4 py-4 hover:text-primary">
                <div className="flex items-center gap-3">
                  <Bell className="size-5 text-amber-400" />
                  <div>
                    <div className="font-bold">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">{alert.vehicle.plateNumber} - scadenta {formatDate(alert.dueAt)}</div>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">{relativeDue(alert.dueAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
