import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Download, Mail, Palette, Send, Settings } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importJsonData, testEmailConfiguration, testTelegramNotification, updateSettings } from "@/app/actions";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-4xl font-black"><Settings className="size-9 text-primary" /> Setari</h1>
        <p className="mt-2 text-muted-foreground">Preferinte, notificari si portabilitatea datelor.</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-2">
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

        <section className="panel p-5">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><Download className="size-5 text-primary" /> Export / Import</h2>
          <div className="grid gap-5">
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Export</h3>
              <div className="flex flex-wrap gap-3">
                <a className="btn-secondary" href="/api/export/json">Descarca JSON</a>
                <a className="btn-secondary" href="/api/export/csv">Descarca CSV</a>
              </div>
            </div>
            <form action={importJsonData} className="mt-4 border-t border-border pt-6">
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
