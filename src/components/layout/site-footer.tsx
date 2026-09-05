import Link from "next/link";

import { TARGET_RETURN } from "@/config/challenge";
import { site } from "@/config/site";
import { env } from "@/lib/env";
import { pct } from "@/lib/utils";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold">{site.name}</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-fg-muted">
            One point when a pick reaches {pct(TARGET_RETURN, 0)} at the deadline. Until then,
            points stay blank.
          </p>
          {env.mockMode ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
              Mock mode · generated dataset
            </p>
          ) : null}
        </div>

        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li>
            <Link href="/leaderboard" className="text-xs text-fg-muted transition-colors hover:text-fg">
              Leaderboard
            </Link>
          </li>
          <li>
            <Link href="/students" className="text-xs text-fg-muted transition-colors hover:text-fg">
              Students
            </Link>
          </li>
          <li>
            <Link href="/features" className="text-xs text-fg-muted transition-colors hover:text-fg">
              Features
            </Link>
          </li>
          <li>
            <Link href="/integrate" className="text-xs text-fg-muted transition-colors hover:text-fg">
              Integration
            </Link>
          </li>
          <li>
            <Link href="/errors" className="text-xs text-fg-muted transition-colors hover:text-fg">
              Errors
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
