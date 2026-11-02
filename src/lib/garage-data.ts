import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadCostCategories } from "@/lib/cost-categories";
import { dismissedKeys, vehicleInclude, type DisplaySettings } from "@/lib/garage";

// Everything a page needs about the signed-in user's garage, loaded once per request.
export const loadGarage = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";

  const [user, vehicles, settingsRow, categories] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.vehicle.findMany({
      where: isAdmin ? {} : { driverId: session.user.id },
      include: vehicleInclude,
      orderBy: { createdAt: "asc" }
    }),
    prisma.appSetting.findUnique({ where: { id: "default" } }),
    loadCostCategories()
  ]);
  if (!user) redirect("/login");

  const settings: DisplaySettings & {
    theme: string;
    notificationsEnabled: boolean;
    notificationTime: string;
    telegramBotToken: string | null;
    telegramChatId: string | null;
  } = {
    theme: settingsRow?.theme ?? "system",
    dateFormat: settingsRow?.dateFormat ?? "system",
    highPriorityDays: settingsRow?.highPriorityDays ?? 14,
    odometerReminderKm: settingsRow?.odometerReminderKm ?? 500,
    notificationsEnabled: settingsRow?.notificationsEnabled ?? true,
    notificationTime: settingsRow?.notificationTime ?? "09:00",
    telegramBotToken: settingsRow?.telegramBotToken ?? null,
    telegramChatId: settingsRow?.telegramChatId ?? null
  };

  return { session, user, isAdmin, vehicles, settings, categories, dismissed: dismissedKeys(settingsRow?.dismissedAlerts) };
});

export type GarageContext = Awaited<ReturnType<typeof loadGarage>>;
