"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const isDark = () =>
  document.documentElement.classList.contains("dark") ||
  (document.documentElement.classList.contains("system") && window.matchMedia("(prefers-color-scheme: dark)").matches);

// Quick per-browser override of the app theme, stored in a cookie read by the root layout.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(isDark()), []);

  return (
    <button
      type="button"
      className="icon-btn"
      title="Temă"
      onClick={() => {
        const next = isDark() ? "light" : "dark";
        document.documentElement.classList.remove("light", "dark", "system");
        document.documentElement.classList.add(next);
        document.cookie = `garaj-theme=${next}; path=/; max-age=31536000; samesite=lax`;
        setDark(next === "dark");
      }}
    >
      {dark ? <Sun className="i" /> : <Moon className="i" />}
    </button>
  );
}
