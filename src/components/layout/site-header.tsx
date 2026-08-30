"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { site } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 overflow-hidden border-b border-border/70 bg-bg/65 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--color-accent)_18%,transparent),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
      <div className="relative mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3.5 px-4 sm:px-6">
        <Link href="/leaderboard" className="group flex min-w-0 items-center gap-3" aria-label={site.name}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface font-mono text-[11px] font-semibold tracking-wide text-fg">
            LS
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-tight sm:text-base">
              {site.name}
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle sm:block">
              Season standings
            </span>
          </span>
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

const STORAGE_KEY = "lasalle-theme";

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid size-9 place-items-center rounded-full border border-border-strong bg-surface/80 text-fg-muted shadow-[0_0_0_1px_rgb(255_255_255_/_0.03)_inset] transition-colors hover:border-accent/40 hover:text-accent-fg"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
