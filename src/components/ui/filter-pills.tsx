import Link from "next/link";

import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filters as links, not client state.
 *
 * Keeping selection in the URL means every leaderboard view is shareable and
 * bookmarkable, the page stays a server component, and the back button does the
 * obvious thing. Worth more here than the few milliseconds a client-side tab
 * switch would save.
 */
export function FilterPills({
  options,
  active,
  paramName,
  searchParams,
  basePath,
  size = "md",
  className,
  label,
}: {
  options: readonly FilterOption[];
  active: string;
  paramName: string;
  searchParams: Record<string, string | undefined>;
  basePath: string;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}) {
  const hrefFor = (value: string) => {
    const params = new URLSearchParams();
    for (const [key, current] of Object.entries(searchParams)) {
      if (current && key !== paramName) params.set(key, current);
    }
    params.set(paramName, value);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label ? (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle sm:inline">
          {label}
        </span>
      ) : null}
      <div
        role="tablist"
        aria-label={label ?? paramName}
        className="scroll-x flex gap-1 rounded-lg border border-border bg-bg-elevated p-1"
      >
        {options.map((option) => {
          const selected = option.value === active;
          return (
            <Link
              key={option.value}
              href={hrefFor(option.value)}
              role="tab"
              aria-selected={selected}
              scroll={false}
              className={cn(
                "whitespace-nowrap rounded-md font-medium transition-colors",
                size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
                selected
                  ? "bg-accent text-white shadow-sm"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
