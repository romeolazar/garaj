import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const data = await prisma.vehicle.findMany({
    include: {
      documents: true,
      reminders: true,
      expenses: true,
      services: true,
      tires: true,
      driver: { select: { email: true, firstName: true, lastName: true } }
    }
  });

  return NextResponse.json({ exportedAt: new Date().toISOString(), vehicles: data });
}
