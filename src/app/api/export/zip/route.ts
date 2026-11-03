import { NextResponse } from "next/server";
import JSZip from "jszip";
import { costEntries } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";
import { backupPayload, costsCsv, documentsCsv } from "@/lib/exports";
import { readStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// One archive: garaj.json for restore, every uploaded file under fisiere/, plus CSV tables for Excel.
export async function GET() {
  const { isAdmin, vehicles, categories } = await loadGarage();
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const payload = await backupPayload(categories);
  const zip = new JSZip();
  zip.file("garaj.json", JSON.stringify(payload, null, 2));
  zip.file("costuri.csv", costsCsv(costEntries(vehicles, categories), categories));
  zip.file("documente.csv", documentsCsv(vehicles));
  for (const file of payload.files) {
    const body = await readStoredFile(file.path).catch(() => null);
    if (body) zip.file(`fisiere/${file.path}`, body);
  }
  zip.file("CITESTE.txt", `Backup Garaj din ${new Date().toLocaleString("ro-RO")}\n\ngaraj.json - toate datele, pentru import în aplicație (Setări → Backup & export)\nfisiere/ - pozele și documentele încărcate, în aceleași foldere ca pe server\ncosturi.csv, documente.csv - tabele pentru Excel\n\nParolele și tokenul Telegram nu sunt incluse.\n`);
  const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return new NextResponse(Buffer.from(body), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="garaj-backup-${payload.exportedAt.slice(0, 10)}.zip"`
    }
  });
}
