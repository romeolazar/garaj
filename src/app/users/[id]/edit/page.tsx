import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUser } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { roleLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black">Editeaza șofer</h1>
          <p className="mt-2 text-muted-foreground">{user.firstName} {user.lastName}</p>
        </div>
        <Link href="/users" className="btn-secondary">Inapoi la șoferi</Link>
      </div>

      <form action={updateUser.bind(null, user.id)} className="panel grid gap-4 p-5 md:grid-cols-2">
        <label><span className="label">Prenume</span><input className="field" name="firstName" defaultValue={user.firstName} required /></label>
        <label><span className="label">Nume</span><input className="field" name="lastName" defaultValue={user.lastName} required /></label>
        <label><span className="label">Email</span><input className="field" name="email" type="email" defaultValue={user.email} required /></label>
        <label>
          <span className="label">Rol</span>
          <select className="field" name="role" defaultValue={user.role}>
            {Object.values(Role).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </label>
        <label className="md:col-span-2"><span className="label">Poza profil URL</span><input className="field" name="profileImageUrl" defaultValue={user.profileImageUrl ?? ""} /></label>
        <label><span className="label">Categorie permis</span><input className="field" name="licenseCategory" defaultValue={user.licenseCategory ?? ""} /></label>
        <label><span className="label">Parola noua optionala</span><input className="field" name="password" type="password" minLength={8} /></label>
        <label><span className="label">Permis obtinut la</span><input className="field" name="licenseIssuedAt" type="date" defaultValue={dateInput(user.licenseIssuedAt)} /></label>
        <label><span className="label">Permis expira la</span><input className="field" name="licenseExpiresAt" type="date" defaultValue={dateInput(user.licenseExpiresAt)} /></label>
        <label><span className="label">CI obtinuta la</span><input className="field" name="idCardIssuedAt" type="date" defaultValue={dateInput(user.idCardIssuedAt)} /></label>
        <label><span className="label">CI expira la</span><input className="field" name="idCardExpiresAt" type="date" defaultValue={dateInput(user.idCardExpiresAt)} /></label>
        <div className="flex justify-end gap-3 md:col-span-2">
          <Link href="/users" className="btn-secondary">Anuleaza</Link>
          <button className="btn" type="submit">Salveaza șofer</button>
        </div>
      </form>
    </AppShell>
  );
}

function dateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
