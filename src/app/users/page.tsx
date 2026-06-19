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

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ view?: string; error?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  const { view: rawView, error } = await searchParams;
  const view = rawView === "list" ? "list" : "card";

  let errorMessage = "";
  if (error === "email-exists") {
    errorMessage = "Această adresă de email este deja folosită de un alt utilizator.";
  } else if (error === "password-mismatch") {
    errorMessage = "Parolele introduse nu se potrivesc.";
  } else if (error === "invalid") {
    errorMessage = "Datele introduse sunt invalide sau parola este prea scurtă (minim 8 caractere).";
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    include: { vehicles: true }
  });

  return (
    <AppShell>
      {errorMessage && (
        <div className="mb-6 rounded-md bg-rose-500/10 p-3 text-sm text-rose-400 border border-rose-500/20">
          {errorMessage}
        </div>
      )}
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
              <label><span className="label">Confirma parola</span><input className="field" name="confirmPassword" type="password" minLength={8} required /></label>
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
              <div key={user.id} className="panel group relative p-5 transition hover:border-primary/60 bg-gradient-to-tr from-rose-500/5 via-card to-primary/5 overflow-hidden">
                {/* Flag / Header of license */}
                <div className="absolute top-4 right-4 flex items-center gap-2 select-none">
                  <div className="flex flex-col items-center justify-center w-5 h-3.5 rounded-sm bg-blue-600 text-white text-[6px] font-black leading-none">
                    <span>★</span>
                    <span className="text-[5px] -mt-0.5">RO</span>
                  </div>
                  {user.licenseCategory && (
                    <span className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-black tracking-wider shadow border border-background">
                      Cat. {user.licenseCategory}
                    </span>
                  )}
                </div>

                <Link href={`/users/${user.id}/edit`} className="block">
                  <div className="flex gap-4 items-center mt-2">
                    {/* Profile Picture */}
                    {user.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.profileImageUrl} alt="" className="size-16 rounded-lg border border-border/80 object-cover bg-muted/40 shadow-sm" />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground font-black text-xl shadow-sm">
                        {userInitials(user)}
                      </div>
                    )}

                    {/* Driver Name & Email */}
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="text-lg font-black text-foreground tracking-tight truncate leading-tight">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border border-border bg-muted/20 p-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold leading-none">Valabilitate Permis</div>
                      <div className="mt-1.5 font-black text-foreground">
                        {user.licenseExpiresAt ? formatDate(user.licenseExpiresAt) : "Fara permis"}
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-muted/20 p-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold leading-none">Numar Auto</div>
                      <div className="mt-1.5 font-black text-primary">
                        {user.vehicles[0] ? user.vehicles[0].plateNumber : "Niciunul"}
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
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
