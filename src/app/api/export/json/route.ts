import { NextResponse } from "next/server";
import { loadGarage } from "@/lib/garage-data";
import { backupPayload } from "@/lib/exports";

export const dynamic = "force-dynamic";

export async function GET() {
  const { isAdmin, categories } = await loadGarage();
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const payload = await backupPayload(categories);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="garaj-backup-${payload.exportedAt.slice(0, 10)}.json"`
    }
  });
}
