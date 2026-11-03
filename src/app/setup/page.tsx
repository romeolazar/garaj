import { redirect } from "next/navigation";
import { createInitialAdmin } from "@/app/actions";
import { AuthCard } from "@/components/auth-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) redirect("/login");
  const { error } = await searchParams;

  return (
    <AuthCard title="Bun venit în Garaj" subtitle="Creează contul de administrator. El va gestiona mașinile și șoferii.">
      {error ? <div className="notice bad">Completează toate câmpurile; parola are minim 8 caractere.</div> : null}
      <form action={createInitialAdmin} className="auth-form">
        <label>Prenume<input className="field" name="firstName" required /></label>
        <label>Nume<input className="field" name="lastName" required /></label>
        <label>Email<input className="field" name="email" type="email" autoComplete="username" required /></label>
        <label>Parolă<input className="field" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
        <button className="btn" type="submit">Creează cont</button>
      </form>
    </AuthCard>
  );
}
