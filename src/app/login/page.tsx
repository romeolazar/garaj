import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthCard } from "@/components/auth-card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins === 0) redirect("/setup");

  const session = await getServerSession(authOptions);
  if (session) redirect("/");
  const { created } = await searchParams;

  return (
    <AuthCard title="Garaj" subtitle="Intră în contul tău">
      {created ? <div className="notice ok">Contul de administrator a fost creat. Te poți autentifica.</div> : null}
      <LoginForm />
    </AuthCard>
  );
}
