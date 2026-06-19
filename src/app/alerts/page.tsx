import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bell, CheckCircle2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dismissReminder } from "@/app/actions";
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
              <div key={alert.id} className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-0">
                <Link href={`/vehicles/${alert.vehicleId}`} className="flex items-center gap-3 flex-1 hover:text-primary min-w-0">
                  <Bell className="size-5 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <div className="font-bold truncate">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">{alert.vehicle.plateNumber} · scadență {formatDate(alert.dueAt)}</div>
                  </div>
                </Link>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right text-sm text-muted-foreground hidden sm:block">{relativeDue(alert.dueAt)}</div>
                  <form action={dismissReminder.bind(null, alert.id)}>
                    <button className="btn-secondary h-8 px-3 text-xs" type="submit">Ascunde</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
