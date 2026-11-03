"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { removeProfilePhoto, uploadProfilePhoto } from "@/app/file-actions";

// Shrinks the photo in the browser so phone pictures upload fast and stay small on disk.
async function resizeImage(file: File, maxSize = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("resize"))), "image/jpeg", 0.88));
}

export function ProfilePhotoUpload({ userId, hasPhoto }: { userId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (file: File) => {
    setError(null);
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await resizeImage(file);
      } catch {
        setError("Imaginea nu a putut fi citită. Folosește JPEG, PNG sau WebP.");
        return;
      }
      const data = new FormData();
      data.append("photo", new File([blob], "profil.jpg", { type: "image/jpeg" }));
      try {
        const result = await uploadProfilePhoto(userId, data);
        if (!result.ok) setError(result.error);
      } catch (err) {
        // e.g. the server rejected the request (proxy/origin) or could not write to /app/data
        setError(`Poza nu a putut fi salvată pe server${err instanceof Error && err.message ? `: ${err.message}` : "."}`);
        console.error("[photo] upload failed", err);
      }
      router.refresh();
    });
  };

  return (
    <div className="photo-upload">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => input.current?.click()}>
        <Camera className="i" />{pending ? "Se încarcă…" : hasPhoto ? "Schimbă poza" : "Încarcă poză"}
      </button>
      {hasPhoto ? (
        <button
          type="button"
          className="icon-sm"
          title="Șterge poza"
          disabled={pending}
          onClick={() => startTransition(async () => {
            setError(null);
            try {
              const result = await removeProfilePhoto(userId);
              if (!result.ok) setError(result.error);
            } catch (err) {
              setError(`Poza nu a putut fi ștearsă${err instanceof Error && err.message ? `: ${err.message}` : "."}`);
              console.error("[photo] remove failed", err);
            }
            router.refresh();
          })}
        >
          <Trash2 className="i" style={{ width: 14, height: 14 }} />
        </button>
      ) : null}
      {error ? <span className="photo-error">{error}</span> : null}
    </div>
  );
}
