"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";

import { NAV_LINKS, site } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Header and primary navigation.
 *
 * Desktop keeps every destination visible because the app is a research tool
 * and jumping between leaderboard, student and stock views is the main
 * interaction. Six links plus the wordmark stop fitting below `lg`, so that is
 * where the same list collapses into a sheet.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Route changes must close the sheet, otherwise it covers the page you asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Background scroll behind an open sheet is disorienting on touch devices.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={site.name}>
          <span className="relative grid size-7 place-items-center overflow-hidden rounded-md border border-accent/40 bg-accent-soft">
            <span className="font-mono text-[11px] font-bold text-accent-fg">V</span>
          </span>
          <span className="hidden text-sm font-semibold tracking-tight xl:inline">{site.name}</span>
          <span className="text-sm font-semibold tracking-tight xl:hidden">{site.shortName}</span>
        </Link>

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                isActive(link.href)
                  ? "bg-surface-hover text-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/admin"
            className={cn(
              "hidden rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg sm:inline-flex",
              isActive("/admin") && "border-accent/40 bg-accent-soft text-accent-fg",
            )}
          >
            Admin
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-9 place-items-center rounded-md border border-border-strong text-fg-muted lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto border-t border-border bg-bg px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {[...NAV_LINKS, { href: "/admin", label: "Admin" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-3 text-[15px] font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-accent-soft text-accent-fg"
                    : "text-fg-muted hover:bg-surface-hover",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

const STORAGE_KEY = "vic-theme";

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
      className="grid size-9 place-items-center rounded-md border border-border-strong text-fg-muted transition-colors hover:text-fg"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
