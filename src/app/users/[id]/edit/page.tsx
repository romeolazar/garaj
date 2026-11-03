import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUser } from "@/app/actions";
import { setProfilePhotoLink } from "@/app/file-actions";
import { AppShell } from "@/components/app-shell";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";
import { Avatar } from "@/components/ui/avatar";
import { roleLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  const { id } = await params;
  const { error } = await searchParams;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  let errorMessage = "";
  if (error === "email-exists") {
    errorMessage = "Această adresă de email este deja folosită de un alt utilizator.";
  } else if (error === "password-mismatch") {
    errorMessage = "Parolele introduse nu se potrivesc.";
  } else if (error === "invalid") {
    errorMessage = "Datele introduse sunt invalide.";
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black">Editeaza șofer</h1>
          <p className="mt-2 text-muted-foreground">{user.firstName} {user.lastName}</p>
        </div>
        <Link href="/users" className="btn-secondary">Inapoi la șoferi</Link>
      </div>

      <section className="panel p-5 mb-4">
        <div className="profile-head" style={{ marginBottom: 0 }}>
          <Avatar name={user} imageUrl={user.profileImageUrl} />
          <div>
            <b>Poza de profil</b>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Apare pe cardul de permis, în banner și în colțul aplicației când {user.firstName} e autentificat.</p>
            <ProfilePhotoUpload userId={user.id} hasPhoto={!!user.profileImageUrl} />
            <form action={setProfilePhotoLink.bind(null, user.id)} className="mt-4 flex flex-wrap items-end gap-2">
              <label className="min-w-64 flex-1"><span className="label">Sau link către o poză de pe internet</span><input className="field" name="profileImageUrl" type="url" placeholder="https://…" defaultValue={user.profileImageUrl?.startsWith("http") ? user.profileImageUrl : ""} /></label>
              <button className="btn-secondary btn-sm" type="submit">Folosește link-ul</button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">Poza se salvează imediat; butonul „Salvează șofer” de mai jos nu o modifică.</p>
          </div>
        </div>
      </section>

      <form action={updateUser.bind(null, user.id)} className="panel grid gap-4 p-5 md:grid-cols-2">
        {errorMessage && (
          <div className="mb-2 rounded-md bg-rose-500/10 p-3 text-sm text-rose-400 border border-rose-500/20 md:col-span-2">
            {errorMessage}
          </div>
        )}
        <label><span className="label">Prenume</span><input className="field" name="firstName" defaultValue={user.firstName} required /></label>
        <label><span className="label">Nume</span><input className="field" name="lastName" defaultValue={user.lastName} required /></label>
        <label><span className="label">Email</span><input className="field" name="email" type="email" defaultValue={user.email} required autoComplete="new-password" /></label>
        <label>
          <span className="label">Rol</span>
          <select className="field" name="role" defaultValue={user.role}>
            {Object.values(Role).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </label>
        <label><span className="label">Categorie permis</span><input className="field" name="licenseCategory" defaultValue={user.licenseCategory ?? ""} /></label>
        <span className="hidden md:block"></span>
        <label><span className="label">Parola noua optionala</span><input className="field" name="password" type="password" minLength={8} autoComplete="new-password" /></label>
        <label><span className="label">Confirma parola noua</span><input className="field" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" /></label>
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
