import Link from "next/link";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { LEADERBOARD_CONFIG } from "@/config/leaderboard";
import { Avatar, Badge, EmptyState, Explain, Td, Th, TableShell } from "@/components/ui/primitives";
import type { LeaderboardEntry } from "@/lib/types";
import { cn, pct } from "@/lib/utils";

const METRIC_HELP = {
  resolved:
    "Predictions whose horizon has elapsed and whose outcome is now known. Active predictions are not scored.",
  hits: "Resolved predictions where the stock reached at least +10% within the horizon.",
  hitRate: "Hits divided by resolved predictions.",
  pts: "Championship points: 1 per hit, 0 per miss. Active picks do not score.",
} as const;

/**
 * Student ranking by championship points. It remains visible during the
 * provisional opening weeks so the leaderboard never collapses into a raw
 * list of picks.
 */
export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No results for this filter"
        description="No student has a resolved prediction inside the selected window yet."
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <TableShell minWidth={520}>
          <thead>
            <tr>
              <Th className="w-14">#</Th>
              <Th>Student</Th>
              <Th align="right">
                <Explain term="Hits">{METRIC_HELP.hits}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Hit rate">{METRIC_HELP.hitRate}</Explain>
              </Th>
              <Th align="right">
                <Explain term="n">{METRIC_HELP.resolved}</Explain>
              </Th>
              <Th align="right" className="w-16">
                <Explain term="Pts">{METRIC_HELP.pts}</Explain>
              </Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.student.id} className="group transition-colors hover:bg-surface-hover">
                <Td className="tnum text-fg-muted">
                  <div className="flex items-center gap-1.5">
                    <RankBadge rank={entry.rank} provisional={entry.provisional} />
                    <RankDelta rank={entry.rank} previous={entry.previousRank} />
                  </div>
                </Td>
                <Td>
                  <Link
                    href={`/students/${entry.student.id}`}
                    className="flex items-center gap-2.5 font-medium transition-colors hover:text-accent-fg"
                  >
                    <Avatar name={entry.student.name} seed={entry.student.avatarSeed} size={28} />
                    <span className="truncate">{entry.student.name}</span>
                    {entry.student.kind === "influencer" ? <Badge tone="cyan">influencer</Badge> : null}
                    {entry.provisional ? <Badge tone="warning">provisional</Badge> : null}
                  </Link>
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.hits}
                </Td>
                <Td align="right" className="tnum font-medium">
                  {pct(entry.metrics.hitRate)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.resolvedPredictions}
                </Td>
                <Td align="right">
                  <span className="tnum text-sm font-semibold">{entry.score}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {entries.map((entry) => (
          <li key={entry.student.id}>
            <Link href={`/students/${entry.student.id}`} className="block px-4 py-3.5">
              <div className="flex items-center gap-3">
                <RankBadge rank={entry.rank} provisional={entry.provisional} />
                <Avatar name={entry.student.name} seed={entry.student.avatarSeed} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.student.name}
                    {entry.student.kind === "influencer" ? " · influencer" : ""}
                  </p>
                  <p className="truncate text-[11px] text-fg-muted">
                    {entry.metrics.hits}/{entry.metrics.resolvedPredictions} hits
                    {entry.provisional ? " · provisional" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-base font-semibold">{entry.score}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">pts</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-fg-subtle sm:px-6">
        Fewer than {LEADERBOARD_CONFIG.minResolvedForRanking} resolved predictions means a
        provisional record: points are real and visible, but the student cannot take an official
        podium place yet. Sample size is always shown so a single lucky call is never mistaken for
        a season record.
      </p>
    </>
  );
}

function RankBadge({ rank, provisional }: { rank: number; provisional: boolean }) {
  if (provisional) {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-dashed border-border-strong font-mono text-[11px] text-fg-subtle">
        —
      </span>
    );
  }

  const tone =
    rank === 1
      ? "border-metal/50 bg-metal/12 text-metal"
      : rank === 2
        ? "border-fg-subtle/40 bg-surface-hover text-fg-muted"
        : rank === 3
          ? "border-warning/35 bg-warning-soft text-warning"
          : "border-border bg-surface text-fg-muted";

  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-semibold",
        tone,
      )}
    >
      {rank}
    </span>
  );
}

function RankDelta({ rank, previous }: { rank: number; previous: number | null }) {
  if (previous === null || previous === rank) {
    return (
      <span className="inline-flex items-center text-fg-subtle" title="No change since last cycle">
        <Minus className="size-3" />
      </span>
    );
  }

  const moved = previous - rank;
  const up = moved > 0;

  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-0.5 text-[10px] font-medium",
        up ? "text-positive" : "text-negative",
      )}
      title={`Was rank ${previous} before the latest cycle`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(moved)}
    </span>
  );
}
