import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Car } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins === 0) redirect("/setup");

  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <section className="panel w-full max-w-md p-7">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary">
            <Car className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Garaj</h1>
            <p className="text-sm text-muted-foreground">Autentificare Șofer</p>
          </div>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
