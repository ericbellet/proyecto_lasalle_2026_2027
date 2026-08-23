import Link from "next/link";
import { Trophy } from "lucide-react";

import { Celebrate } from "@/components/ui/celebrate";
import { Avatar, Badge } from "@/components/ui/primitives";
import type { LeaderboardEntry } from "@/lib/types";
import { cn, pct, signedPct } from "@/lib/utils";

/**
 * The top three.
 *
 * Rank one gets the metal treatment; two and three are ordinary panels. The
 * effect is deliberately scarce — used on more than one element it stops
 * reading as "the winner" and starts reading as decoration.
 */
export function Champion({
  entries,
  celebrate = false,
}: {
  entries: LeaderboardEntry[];
  celebrate?: boolean;
}) {
  const [first, second, third] = entries;
  if (!first) return null;

  // minmax(0,…) rather than plain fr: student names are truncated, and a nowrap
  // text node inside an auto-floored track drags the whole page wider.
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {celebrate ? <Celebrate once={`champion:${first.student.id}`} /> : null}

      <article className="panel relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--color-metal)_14%,transparent),transparent_60%)]" />

        <div className="relative flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <Badge tone="metal">
              <Trophy className="size-3" /> Rank 1
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
              n = {first.metrics.resolvedPredictions} resolved
            </span>
          </div>

          <div className="flex items-center gap-4">
            <MetalMedal rank={1} />
            <div className="min-w-0">
              <Link
                href={`/students/${first.student.id}`}
                className="block truncate text-2xl font-semibold tracking-tight hover:text-accent-fg sm:text-3xl"
              >
                {first.student.name}
              </Link>
              <p className="mt-1 truncate text-sm text-fg-muted">
                {first.modelVersion
                  ? `${first.modelVersion.name} · ${first.modelVersion.version}`
                  : "No model registered"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <ChampionStat label="Score" value={first.score.toFixed(1)} highlight />
            <ChampionStat label="Hit rate" value={pct(first.metrics.hitRate)} />
            <ChampionStat label="Avg return" value={signedPct(first.metrics.averageReturn)} />
            <ChampionStat label="Brier" value={first.metrics.brierScore.toFixed(3)} />
          </div>
        </div>
      </article>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {[second, third].filter(Boolean).map((entry) => (
          <RunnerUp key={(entry as LeaderboardEntry).student.id} entry={entry as LeaderboardEntry} />
        ))}
      </div>
    </div>
  );
}

function MetalMedal({ rank }: { rank: number }) {
  return (
    <span className="liquid-metal grid size-16 shrink-0 place-items-center rounded-full border border-metal/50 sm:size-20">
      <span className="liquid-metal-sheen" />
      <span className="relative z-10 font-mono text-2xl font-bold text-[#2a1f08] sm:text-3xl">
        {rank}
      </span>
    </span>
  );
}

function ChampionStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p
        className={cn(
          "tnum mt-0.5 text-lg font-semibold tracking-tight",
          highlight && "text-metal",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RunnerUp({ entry }: { entry: LeaderboardEntry }) {
  const tone = entry.rank === 2 ? "border-fg-subtle/40" : "border-warning/30";

  return (
    <article className={cn("panel flex items-center gap-4 p-4 sm:p-5", tone)}>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border font-mono text-base font-bold",
          entry.rank === 2
            ? "border-fg-subtle/50 bg-surface-hover text-fg-muted"
            : "border-warning/40 bg-warning-soft text-warning",
        )}
      >
        {entry.rank}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/students/${entry.student.id}`}
          className="block truncate text-sm font-semibold hover:text-accent-fg"
        >
          {entry.student.name}
        </Link>
        <p className="truncate text-xs text-fg-muted">
          {entry.modelVersion?.name ?? "—"} · {pct(entry.metrics.hitRate)} hit rate
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum text-lg font-semibold tracking-tight">{entry.score.toFixed(1)}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">score</p>
      </div>

      <Avatar name={entry.student.name} seed={entry.student.avatarSeed} size={36} className="hidden sm:flex" />
    </article>
  );
}
