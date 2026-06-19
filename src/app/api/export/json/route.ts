import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    include: {
      documents: true,
      reminders: true,
      expenses: true,
      services: true,
      tires: true,
      driver: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          role: true,
          licenseCategory: true,
          licenseIssuedAt: true,
          licenseExpiresAt: true,
          idCardIssuedAt: true,
          idCardExpiresAt: true
        }
      }
    }
  });

  const users = await prisma.user.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      role: true,
      licenseCategory: true,
      licenseIssuedAt: true,
      licenseExpiresAt: true,
      idCardIssuedAt: true,
      idCardExpiresAt: true
    }
  });

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    vehicles,
    users
  });
}
