import Link from "next/link";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { BarChart3, Bell, Car, Gauge, LogOut, Settings, UserRound, UsersRound } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;
  const pendingAlerts = session?.user?.id
    ? await prisma.reminder.count({ where: { status: "PENDING", notifyAt: { lte: new Date() } } })
    : 0;
  const email = user?.email ?? session?.user?.email ?? "";
  const avatarUrl = user?.profileImageUrl || gravatarUrl(email);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-card lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary shadow-glow">
            <Car className="size-5" />
          </div>
          <span className="text-xl font-black tracking-wide">GARAJ</span>
        </div>
        <nav className="space-y-2 px-5 py-8 text-sm font-semibold text-muted-foreground">
          <Link className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-muted hover:text-foreground" href="/">
            <Gauge className="size-5" />
            Panou principal
          </Link>
          {session?.user?.role === "ADMIN" ? (
            <Link className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-muted hover:text-foreground" href="/users">
              <UsersRound className="size-5" />
              Șoferi
            </Link>
          ) : null}
          <Link className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-muted hover:text-foreground" href="/reports">
            <BarChart3 className="size-5" />
            Rapoarte
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-muted hover:text-foreground" href="/settings">
            <Settings className="size-5" />
            Setari
          </Link>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="mb-4 flex items-center gap-3 rounded-full border border-border px-4 py-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-9 rounded-full border border-border bg-muted object-cover" />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full bg-primary">
                <UserRound className="size-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{user ? `${user.firstName} ${user.lastName}` : "Admin"}</div>
              <div className="truncate text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
          <Link href="/api/auth/signout" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-muted-foreground">
            <LogOut className="size-4" />
            Deconectare
          </Link>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-border bg-card/90 px-5 backdrop-blur lg:px-10">
          <Link className="flex items-center gap-3 font-black lg:hidden" href="/">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary">
              <Car className="size-4" />
            </span>
            GARAJ
          </Link>
          <div className="hidden lg:block" />
          <Link href="/alerts" className="relative rounded-md p-2 hover:bg-muted" aria-label="Alerte">
            <Bell className="size-5 text-muted-foreground" />
            {pendingAlerts > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {pendingAlerts}
              </span>
            ) : null}
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-10 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function gravatarUrl(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  const hash = crypto.createHash("md5").update(normalized).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=96&d=identicon`;
}
