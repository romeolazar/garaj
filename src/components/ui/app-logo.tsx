// App icon: garage roof over a car front, on an indigo → violet → pink gradient, with a spark.
export function AppLogo({ id = "logo", className }: { id?: string; className?: string }) {
  const g = `lg-${id}`;
  const h = `lh-${id}`;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4338ca" />
          <stop offset=".5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id={h} cx=".22" cy=".12" r=".85">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${g})`} />
      <rect width="48" height="48" rx="14" fill={`url(#${h})`} />
      <path d="M9 21.5 24 10.5l15 11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 35v-5.6c0-1.4.9-2.6 2.2-3l2.2-4.6c.45-.9 1.35-1.4 2.3-1.4h6.6c.95 0 1.85.5 2.3 1.4l2.2 4.6c1.3.4 2.2 1.6 2.2 3V35z" fill="#fff" />
      <path d="M19.6 25.6l1.6-3.3c.2-.4.6-.6 1-.6h3.6c.4 0 .8.2 1 .6l1.6 3.3z" fill={`url(#${g})`} opacity=".55" />
      <rect x="14" y="34" width="4.6" height="3.8" rx="1.3" fill="#fff" />
      <rect x="29.4" y="34" width="4.6" height="3.8" rx="1.3" fill="#fff" />
      <circle cx="18.6" cy="30.3" r="1.9" fill={`url(#${g})`} />
      <circle cx="29.4" cy="30.3" r="1.9" fill={`url(#${g})`} />
      <path d="M22.2 31h3.6" stroke={`url(#${g})`} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M38.6 6.2l.95 2.25 2.25.95-2.25.95-.95 2.25-.95-2.25-2.25-.95 2.25-.95z" fill="#fff" />
    </svg>
  );
}
