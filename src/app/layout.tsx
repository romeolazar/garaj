import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garaj",
  description: "Asistent personal pentru masini din Romania"
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } }).catch(() => null);
  const theme = settings?.theme === "light" || settings?.theme === "system" ? settings.theme : "dark";

  return (
    <html lang="ro" className={theme}>
      <body>{children}</body>
    </html>
  );
}
