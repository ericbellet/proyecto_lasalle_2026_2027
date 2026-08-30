"use client";

import { useMemo, useState } from "react";

import { Badge, Panel } from "@/components/ui/primitives";
import {
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  type FeatureGroupId,
} from "@/lib/features/catalog";
import { cn } from "@/lib/utils";

export function FeatureExplorer({ initialGroup = "" }: { initialGroup?: string }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<FeatureGroupId | "">(
    FEATURE_GROUPS.some((item) => item.id === initialGroup)
      ? (initialGroup as FeatureGroupId)
      : "",
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return FEATURE_CATALOG.filter((feature) => {
      if (group && feature.group !== group) return false;
      if (!needle) return true;
      const hay = [feature.id, feature.name, feature.why, feature.formula, ...(feature.aliases ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [group, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="P/E, ROIC, influencer, moat, RSI…"
            className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm text-fg outline-none transition-colors hover:border-border-strong focus:border-accent"
          />
        </label>
        <p className="font-mono text-[11px] text-fg-subtle sm:pb-2.5">
          {rows.length} / {FEATURE_CATALOG.length}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <GroupChip active={group === ""} onClick={() => setGroup("")} label="All" />
        {FEATURE_GROUPS.map((item) => (
          <GroupChip
            key={item.id}
            active={group === item.id}
            onClick={() => setGroup(item.id)}
            label={item.label}
            metal={item.id === "influencers"}
          />
        ))}
      </div>

      <Panel className="overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((feature) => (
            <li key={feature.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold">{feature.name}</p>
                  {feature.inStore ? <Badge tone="cyan">in store</Badge> : <Badge>build it</Badge>}
                  {feature.group === "influencers" ? <Badge tone="metal">influencers</Badge> : null}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-fg-subtle">{feature.id}</p>
              </div>
              <div className="min-w-0">
                {feature.formula ? (
                  <p className="font-mono text-[11px] text-accent-fg">{feature.formula}</p>
                ) : null}
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{feature.why}</p>
                {feature.source ? (
                  <p className="mt-1 font-mono text-[10px] text-fg-subtle">Source · {feature.source}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-fg-muted">No feature matches that search.</p>
        ) : null}
      </Panel>
    </div>
  );
}

function GroupChip({
  label,
  active,
  onClick,
  metal,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  metal?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
        active && metal && "border-metal/50 bg-metal/15 text-metal",
        active && !metal && "border-accent/40 bg-accent-soft text-accent-fg",
        !active && "border-border bg-surface text-fg-subtle hover:border-border-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
