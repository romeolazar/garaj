"use client";

import { useState } from "react";

// Photo with initials underneath; a broken or expired link falls back to the initials.
export function Avatar({ name, imageUrl, className = "" }: { name: { firstName: string; lastName?: string | null }; imageUrl?: string | null; className?: string }) {
  // Remember which URL failed, so a newly uploaded photo is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = `${name.firstName[0] ?? ""}${(name.lastName ?? " ")[0] ?? ""}`.toUpperCase();
  return (
    <span className={`av ${className}`}>
      <span>{initials}</span>
      {imageUrl && failedUrl !== imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} />
      ) : null}
    </span>
  );
}
