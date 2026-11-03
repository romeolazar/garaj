"use client";

import { useEffect, useRef, useState } from "react";

// Photo with initials underneath; a broken or expired link falls back to the initials.
export function Avatar({ name, imageUrl, className = "" }: { name: { firstName: string; lastName?: string | null }; imageUrl?: string | null; className?: string }) {
  // Remember which URL failed, so a newly uploaded photo is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const initials = `${name.firstName[0] ?? ""}${(name.lastName ?? " ")[0] ?? ""}`.toUpperCase();

  // A server-rendered <img> can fail before React attaches onError; catch that case after hydration.
  useEffect(() => {
    const el = img.current;
    if (el && imageUrl && el.complete && el.naturalWidth === 0) setFailedUrl(imageUrl);
  }, [imageUrl]);

  return (
    <span className={`av ${className}`}>
      <span>{initials}</span>
      {imageUrl && failedUrl !== imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} />
      ) : null}
    </span>
  );
}
