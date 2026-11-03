import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Uploaded files live in the data volume, next to the database.
export const FILES_DIR = path.resolve(process.env.FILES_DIR ?? path.join(process.env.DATA_DIR ?? "./data", "fisiere"));
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Kind = "image" | "pdf";
const TYPES: Array<{ mime: string; ext: string; kind: Kind; test: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", ext: "jpg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", kind: "image", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", kind: "image", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "application/pdf", ext: "pdf", kind: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" }
];

export class StorageError extends Error {}

export function slug(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "fisier";
}

// Folder for a car: its plate number without spaces, e.g. "TM 50 HEY" → "TM50HEY".
export function plateFolder(plateNumber: string) {
  return plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "") || "MASINA";
}

function resolveSafe(relative: string) {
  const absolute = path.resolve(FILES_DIR, relative);
  if (!absolute.startsWith(FILES_DIR + path.sep)) throw new StorageError("Cale invalidă.");
  return absolute;
}

// Checks the real file type from its first bytes (not the name), then writes it under FILES_DIR/folder.
export async function storeFile({ file, folder, baseName, allow, maxBytes = MAX_FILE_BYTES }: { file: File; folder: string[]; baseName: string; allow: Kind[]; maxBytes?: number }) {
  if (!file.size) throw new StorageError("Fișierul este gol.");
  if (file.size > maxBytes) throw new StorageError(`Fișierul depășește ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = TYPES.find((candidate) => allow.includes(candidate.kind) && candidate.test(buffer));
  if (!type) throw new StorageError(allow.includes("pdf") ? "Sunt acceptate doar imagini (JPEG, PNG, WebP) și PDF." : "Sunt acceptate doar imagini JPEG, PNG sau WebP.");

  const name = `${slug(baseName)}-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString("hex")}.${type.ext}`;
  const relative = path.posix.join(...folder.map((part) => part.replace(/[^A-Za-z0-9-]/g, "") || "x"), name);
  const absolute = resolveSafe(relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer, { flag: "wx" });
  return { path: relative, mimeType: type.mime, size: buffer.length, originalName: (file.name || name).slice(0, 200) };
}

export async function readStoredFile(relative: string) {
  return fs.readFile(resolveSafe(relative));
}

export async function removeStoredFile(relative: string) {
  try {
    await fs.unlink(resolveSafe(relative));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
