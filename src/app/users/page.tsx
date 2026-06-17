import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { LayoutGrid, List, Pencil, Plus, UserCog } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DeleteUserButton } from "@/components/delete-user-button";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  const { view: rawView } = await searchParams;
  const view = rawView === "list" ? "list" : "card";

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    include: { vehicles: true }
  });

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black"><UserCog className="size-9 text-primary" /> Lista Șoferi</h1>
          <p className="mt-2 text-muted-foreground">Adauga administratori si șoferi care pot primi vehicule alocate.</p>
        </div>
        <details className="relative">
          <summary className="btn cursor-pointer list-none">
            <Plus className="size-4" />
            Adauga șofer
          </summary>
          <form action={createUser} className="absolute right-0 z-20 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="grid gap-4">
              <label><span className="label">Prenume</span><input className="field" name="firstName" required /></label>
              <label><span className="label">Nume</span><input className="field" name="lastName" required /></label>
              <label><span className="label">Email</span><input className="field" name="email" type="email" required /></label>
              <label><span className="label">Parola initiala</span><input className="field" name="password" type="password" minLength={8} required /></label>
              <label>
                <span className="label">Rol</span>
                <select className="field" name="role" defaultValue={Role.DRIVER}>
                  {Object.values(Role).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Salveaza șofer</button>
            </div>
          </form>
        </details>
      </div>

      <div className="mb-4 flex justify-end">
        <div className="flex rounded-md border border-border bg-muted/30 p-1 text-sm">
          <DriverViewLink href="/users?view=list" active={view === "list"} icon={List} label="Lista" />
          <DriverViewLink href="/users?view=card" active={view === "card"} icon={LayoutGrid} label="Card" />
        </div>
      </div>

      <section>
        {view === "list" ? (
        <div className="panel p-5">
          <div className="divide-y divide-border">
            {users.map((user) => (
              <div key={user.id} className="group relative flex items-center justify-between gap-4 py-4 pr-24">
                <div className="flex min-w-0 items-center gap-3">
                  {user.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImageUrl} alt="" className="size-11 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                      {userInitials(user)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold">{user.firstName} {user.lastName}</div>
                    <div className="truncate text-sm text-muted-foreground">{user.email} - {roleLabels[user.role]} - {user.vehicles.length} vehicule</div>
                  </div>
                </div>
                <div className="absolute bottom-3 right-0 flex gap-2 opacity-0 transition group-hover:opacity-100">
                  <Link href={`/users/${user.id}/edit`} className="flex size-9 items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                    <Pencil className="size-4" />
                  </Link>
                  {session.user.id !== user.id ? (
                    <DeleteUserButton action={deleteUser.bind(null, user.id)} label={`${user.firstName} ${user.lastName}`} iconOnly />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <div key={user.id} className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-lg transition hover:border-primary">
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/35 via-accent/20 to-transparent" />
                <div className="relative z-10 flex items-start gap-4 pr-16">
                  {user.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profileImageUrl} alt="" className="size-16 rounded-lg border border-border bg-muted object-cover shadow" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-lg bg-primary text-xl font-black text-primary-foreground shadow">
                      {userInitials(user)}
                    </div>
                  )}
                  <div className="min-w-0 pt-1">
                    <div className="text-xl font-black">{user.firstName} {user.lastName}</div>
                    <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase text-muted-foreground">Categorie permis</div>
                    <div className="mt-1 font-bold">{user.licenseCategory || "N/A"}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase text-muted-foreground">Permis expiră</div>
                    <div className="mt-1 font-bold">{formatDate(user.licenseExpiresAt)}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase text-muted-foreground">Rol</div>
                    <div className="mt-1 font-bold">{roleLabels[user.role]}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase text-muted-foreground">Mașina alocată</div>
                    <div className="mt-1 truncate font-bold">{user.vehicles[0] ? `${user.vehicles[0].make} ${user.vehicles[0].model}` : "N/A"}</div>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 z-20 flex gap-2 opacity-0 transition group-hover:opacity-100">
                  <Link href={`/users/${user.id}/edit`} className="flex size-9 items-center justify-center rounded-md border border-border bg-card/90 shadow-lg backdrop-blur hover:border-primary" title="Editeaza">
                    <Pencil className="size-4" />
                  </Link>
                  {session.user.id !== user.id ? (
                    <DeleteUserButton action={deleteUser.bind(null, user.id)} label={`${user.firstName} ${user.lastName}`} iconOnly />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function DriverViewLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof List; label: string }) {
  return (
    <Link href={href} className={`inline-flex size-9 items-center justify-center rounded transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title={label} aria-label={label}>
      <Icon className="size-4" />
    </Link>
  );
}

function userInitials(user: { firstName: string; lastName: string }) {
  return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
}
