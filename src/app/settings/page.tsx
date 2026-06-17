import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Download, Mail, Palette, Send, Settings } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importJsonData, testEmailConfiguration, testTelegramNotification, updateProfile, updateSettings } from "@/app/actions";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [settings, user] = await Promise.all([
    prisma.appSetting.findUnique({ where: { id: "default" } }),
    prisma.user.findUnique({ where: { id: session.user.id } })
  ]);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-4xl font-black"><Settings className="size-9 text-primary" /> Setari</h1>
        <p className="mt-2 text-muted-foreground">Profil, notificari si portabilitatea datelor.</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-2">
        <form action={updateProfile} className="panel p-5">
          <h2 className="mb-5 text-xl font-black">Profil șofer</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="label">Email si notificari</span><input className="field" name="email" type="email" defaultValue={user?.email ?? ""} required /></label>
            <label><span className="label">Prenume</span><input className="field" name="firstName" defaultValue={user?.firstName ?? ""} required /></label>
            <label><span className="label">Nume</span><input className="field" name="lastName" defaultValue={user?.lastName ?? ""} required /></label>
            <label className="md:col-span-2"><span className="label">Poză profil URL opțională</span><input className="field" name="profileImageUrl" defaultValue={user?.profileImageUrl ?? ""} placeholder="Dacă lipsește, se folosește Gravatar după email" /></label>
            <label><span className="label">Categorie permis</span><input className="field" name="licenseCategory" defaultValue={user?.licenseCategory ?? ""} placeholder="B, BE, C" /></label>
            <label><span className="label">Permis obținut la</span><input className="field" name="licenseIssuedAt" type="date" defaultValue={dateInput(user?.licenseIssuedAt)} /></label>
            <label><span className="label">Permis expiră la</span><input className="field" name="licenseExpiresAt" type="date" defaultValue={dateInput(user?.licenseExpiresAt)} /></label>
            <label><span className="label">Memento CI obținută la</span><input className="field" name="idCardIssuedAt" type="date" defaultValue={dateInput(user?.idCardIssuedAt)} /></label>
            <label><span className="label">Memento CI expiră la</span><input className="field" name="idCardExpiresAt" type="date" defaultValue={dateInput(user?.idCardExpiresAt)} /></label>
          </div>
          <h3 className="mb-3 mt-6 text-sm font-bold uppercase text-muted-foreground">Schimbare parolă</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className="label">Parola curentă</span><input className="field" name="currentPassword" type="password" autoComplete="current-password" /></label>
            <label><span className="label">Parola nouă</span><input className="field" name="newPassword" type="password" minLength={8} autoComplete="new-password" /></label>
            <label><span className="label">Confirmă parola nouă</span><input className="field" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" /></label>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Pentru schimbarea parolei sunt necesare parola curentă și confirmarea parolei noi.</p>
          <p className="mt-4 text-sm text-muted-foreground">Această adresă va fi folosită și pentru notificările email.</p>
          <button className="btn mt-5" type="submit">Salvează profil</button>
        </form>

        <form action={updateSettings} className="panel p-5">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><Palette className="size-5 text-primary" /> Preferinte</h2>
          <div className="grid gap-4">
            <label>
              <span className="label">Tema</span>
              <select className="field" name="theme" defaultValue={settings?.theme ?? "system"}>
                <option value="system">Sistem</option>
                <option value="dark">Intunecata</option>
                <option value="light">Luminoasa</option>
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="label">Telegram bot token</span><input className="field" name="telegramBotToken" defaultValue={settings?.telegramBotToken ?? ""} /></label>
              <label><span className="label">Telegram chat ID</span><input className="field" name="telegramChatId" defaultValue={settings?.telegramChatId ?? ""} /></label>
            </div>
            <div>
              <button className="btn-secondary" formAction={testTelegramNotification} type="submit">Testeaza Telegram</button>
            </div>
          </div>

          <h2 className="mb-5 mt-8 flex items-center gap-2 text-xl font-black"><Mail className="size-5 text-accent" /> Gmail SMTP</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label><span className="label">Utilizator Gmail</span><input className="field" name="smtpUser" type="email" defaultValue={settings?.smtpUser ?? ""} placeholder="nume@gmail.com" /></label>
            <label><span className="label">Parola Gmail / App Password</span><input className="field" name="smtpPassword" type="password" defaultValue={settings?.smtpPassword ?? ""} /></label>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Momentan aplicatia foloseste doar Google SMTP: smtp.gmail.com, port 465, SSL. Pentru conturile Gmail este recomandata o App Password.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn" type="submit"><Send className="size-4" /> Salveaza setari</button>
            <button className="btn-secondary" formAction={testEmailConfiguration} type="submit">Testeaza email</button>
          </div>
        </form>

        <section className="panel p-5 xl:col-span-2">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><Download className="size-5 text-primary" /> Export / Import</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Export</h3>
              <div className="flex flex-wrap gap-3">
                <a className="btn-secondary" href="/api/export/json">Descarca JSON</a>
                <a className="btn-secondary" href="/api/export/csv">Descarca CSV</a>
              </div>
            </div>
            <form action={importJsonData}>
              <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Import</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input className="field" name="jsonFile" type="file" accept="application/json,.json" required />
                <button className="btn" type="submit">Importa JSON</button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Importul JSON restaureaza vehiculele, registrul, cheltuielile, reviziile si anvelopele din exportul aplicatiei.</p>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function dateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
