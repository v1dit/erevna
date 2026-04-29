"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("erevna-theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("erevna-theme", next);
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? (
        /* Four filled dots — dense/dark; click to open up to light */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="4" cy="4" r="1.6" fill="currentColor" />
          <circle cx="10" cy="4" r="1.6" fill="currentColor" />
          <circle cx="4" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
        </svg>
      ) : (
        /* Four outlined dots — open/light; click to close back to dark */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="4" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="10" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="4" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="10" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
    </button>
  );
}
