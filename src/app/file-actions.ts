"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeStoredFile, slug, storeFile, StorageError } from "@/lib/storage";

export type UploadResult = { ok: true } | { ok: false, error: string };

// Admins can change anyone's photo; everyone else only their own.
async function canEditUser(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  return session.user.role === "ADMIN" || session.user.id === userId;
}

async function removeAvatars(userId: string) {
  const old = await prisma.fileAttachment.findMany({ where: { userId, kind: "avatar" } });
  for (const file of old) await removeStoredFile(file.path);
  await prisma.fileAttachment.deleteMany({ where: { id: { in: old.map((file) => file.id) } } });
}

// The driver photo is also the photo of the account (same User row).
export async function uploadProfilePhoto(userId: string, formData: FormData): Promise<UploadResult> {
  if (!(await canEditUser(userId))) return { ok: false, error: "Nu ai voie să schimbi această poză." };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const file = formData.get("photo");
  if (!user || !(file instanceof File)) return { ok: false, error: "Alege o imagine." };

  try {
    const stored = await storeFile({ file, folder: ["soferi", slug(`${user.firstName} ${user.lastName}`)], baseName: "profil", allow: ["image"], maxBytes: 8 * 1024 * 1024 });
    await removeAvatars(userId);
    const attachment = await prisma.fileAttachment.create({ data: { ...stored, kind: "avatar", userId } });
    await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: `/api/files/${attachment.id}` } });
  } catch (error) {
    if (error instanceof StorageError) return { ok: false, error: error.message };
    // Most often the data volume is not writable; report it instead of failing silently.
    console.error("[photo] could not store profile photo:", error);
    return { ok: false, error: "Serverul nu a putut salva fișierul (verifică drepturile de scriere pe volumul /app/data)." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// Use a photo from the internet instead of an uploaded one.
export async function setProfilePhotoLink(userId: string, formData: FormData): Promise<void> {
  if (!(await canEditUser(userId))) return;
  const raw = formData.get("profileImageUrl");
  const link = typeof raw === "string" ? raw.trim() : "";
  if (link && !/^https?:\/\/\S+$/i.test(link)) return;
  await removeAvatars(userId);
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: link || null } });
  revalidatePath("/", "layout");
}

export async function removeProfilePhoto(userId: string): Promise<UploadResult> {
  if (!(await canEditUser(userId))) return { ok: false, error: "Nu ai voie să schimbi această poză." };
  await removeAvatars(userId);
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: null } });
  revalidatePath("/", "layout");
  return { ok: true };
}
