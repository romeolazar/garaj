import { redirect } from "next/navigation";

// The car page now lives in the dashboard; keep old links working.
export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const tabs: Record<string, string> = { date: "general", registru: "registry", cheltuieli: "costs", rate: "costs", revizii: "costs", anvelope: "tires" };
  redirect(`/?car=${encodeURIComponent(id)}&tab=${tabs[tab ?? ""] ?? "general"}`);
}
