import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createInitialAdmin } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const users = await prisma.user.count();
  if (users > 0) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <form action={createInitialAdmin} className="panel w-full max-w-md p-7">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary">
            <Car className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Creeaza administrator</h1>
            <p className="text-sm text-muted-foreground">Primul cont va administra aplicatia.</p>
          </div>
        </div>
        <div className="grid gap-4">
          <label>
            <span className="label">Prenume</span>
            <input className="field" name="firstName" required />
          </label>
          <label>
            <span className="label">Nume</span>
            <input className="field" name="lastName" required />
          </label>
          <label>
            <span className="label">Email</span>
            <input className="field" name="email" type="email" required />
          </label>
          <label>
            <span className="label">Parola</span>
            <input className="field" name="password" type="password" minLength={8} required />
          </label>
          <button className="btn mt-2" type="submit">Creeaza cont</button>
        </div>
      </form>
    </main>
  );
}
