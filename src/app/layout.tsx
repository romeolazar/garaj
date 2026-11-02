import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Garaj",
  description: "Asistent personal pentru mașini din România"
};

export const dynamic = "force-dynamic";

const THEMES = ["light", "dark", "system"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } }).catch(() => null);
  const override = (await cookies()).get("garaj-theme")?.value;
  const theme = override && THEMES.includes(override) ? override : THEMES.includes(settings?.theme ?? "") ? settings!.theme : "system";

  return (
    <html lang="ro" className={`${theme} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
