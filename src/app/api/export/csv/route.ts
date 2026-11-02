import { NextResponse } from "next/server";
import { costEntries } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";
import { costsCsv } from "@/lib/exports";

export const dynamic = "force-dynamic";

// Costs of the signed-in user's cars; ?year=2026 limits to one year.
export async function GET(request: Request) {
  const { vehicles, categories } = await loadGarage();
  const year = new URL(request.url).searchParams.get("year");
  const entries = costEntries(vehicles, categories).filter((e) => !year || String(e.date.getFullYear()) === year);

  return new NextResponse(costsCsv(entries, categories), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=garaj-costuri${year ? `-${year}` : ""}.csv`
    }
  });
}
