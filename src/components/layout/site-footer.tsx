import Link from "next/link";

import { TARGET_RETURN } from "@/config/challenge";
import { site } from "@/config/site";
import { env } from "@/lib/env";
import { pct } from "@/lib/utils";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-semibold">{site.name}</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-fg-muted">
            Students build the data lakes, models and agents. This platform pulls their predictions,
            locks them before the outcome is known, and scores them on whether a stock reached{" "}
            {pct(TARGET_RETURN, 0)} within the horizon.
          </p>
          {env.mockMode ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
              Mock mode · generated dataset
            </p>
          ) : null}
        </div>

        <FooterColumn
          title="Platform"
          links={[
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/consensus", label: "Consensus" },
            { href: "/history", label: "Cycle history" },
            { href: "/methodology", label: "Methodology" },
          ]}
        />
        <FooterColumn
          title="For students"
          links={[
            { href: "/integrate", label: "Integration guide" },
            { href: "/methodology#scoring", label: "How scoring works" },
            { href: "/admin", label: "Endpoint status" },
          ]}
        />
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-4 text-[11px] text-fg-subtle sm:px-6">
          Every prediction is recorded before the outcome is known. Snapshots are immutable once
          locked.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-xs text-fg-muted transition-colors hover:text-fg">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
