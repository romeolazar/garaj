import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const vehicles = await prisma.vehicle.findMany({ include: { expenses: true, documents: true } });
  const rows = [
    ["plateNumber", "make", "model", "vin", "documents", "totalExpenses"].map(escapeCsv).join(","),
    ...vehicles.map((vehicle) =>
      [
        vehicle.plateNumber,
        vehicle.make,
        vehicle.model,
        vehicle.vin,
        vehicle.documents.length,
        vehicle.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
      ].map(escapeCsv).join(",")
    )
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=garaj-export.csv"
    }
  });
}
