import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Serves an uploaded file to signed-in users. Car files are limited to admins and the car's driver;
// profile photos are visible to everyone signed in (they appear on driver cards and in the top bar).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await prisma.fileAttachment.findUnique({ where: { id }, include: { vehicle: { select: { driverId: true } } } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  if (file.vehicle && session.user.role !== "ADMIN" && file.vehicle.driverId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await readStoredFile(file.path).catch(() => null);
  if (!body) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": file.mimeType,
      "content-length": String(body.length),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff"
    }
  });
}
