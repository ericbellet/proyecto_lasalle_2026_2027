import Link from "next/link";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { LEADERBOARD_CONFIG } from "@/config/leaderboard";
import {
  Avatar,
  Badge,
  EmptyState,
  Explain,
  Meter,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import type { LeaderboardEntry } from "@/lib/types";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

const METRIC_HELP = {
  resolved:
    "Predictions whose horizon has elapsed and whose outcome is now known. Active predictions are not scored.",
  hits: "Resolved predictions where the stock reached at least +10% within the horizon.",
  hitRate: "Hits divided by resolved predictions.",
  avgReturn: "Mean realized return across all resolved predictions, including the losses.",
  avgAlpha:
    "Mean return minus the equal-weight benchmark over the same window. Positive means the pick beat simply holding the universe.",
  brier:
    "Mean squared error of the stated probabilities: (p − outcome)². Lower is better. 0.25 is what you get by always saying 50%.",
  calibration:
    "Average gap between stated probability and observed frequency, weighted by how many predictions fall in each bin. Lower is better.",
  score:
    "30% hit rate, 25% calibration, 25% relative return, 10% consistency, 10% sample reliability. Each component is measured against the cohort.",
} as const;

/**
 * The full ranking.
 *
 * Two renderings of the same data: a dense table from `md` up, and stacked
 * cards below it. A twelve-column financial table squeezed into 375px is
 * unreadable no matter how well the horizontal scroll behaves, so on phones the
 * secondary metrics move into a two-row grid instead.
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
        <TableShell minWidth={980}>
          <thead>
            <tr>
              <Th className="w-14">#</Th>
              <Th>Student</Th>
              <Th>Model</Th>
              <Th align="right">
                <Explain term="Resolved">{METRIC_HELP.resolved}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Hits">{METRIC_HELP.hits}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Hit rate">{METRIC_HELP.hitRate}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Avg return">{METRIC_HELP.avgReturn}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Avg alpha">{METRIC_HELP.avgAlpha}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Brier">{METRIC_HELP.brier}</Explain>
              </Th>
              <Th align="right">
                <Explain term="Calib.">{METRIC_HELP.calibration}</Explain>
              </Th>
              <Th align="right" className="w-28">
                <Explain term="Score">{METRIC_HELP.score}</Explain>
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
                    {entry.provisional ? <Badge tone="warning">provisional</Badge> : null}
                  </Link>
                </Td>
                <Td className="max-w-[200px]">
                  {entry.modelVersion ? (
                    <div className="truncate">
                      <span className="text-xs text-fg">{entry.modelVersion.name}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-fg-subtle">
                        {entry.modelVersion.version}
                      </span>
                    </div>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.resolvedPredictions}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.hits}
                </Td>
                <Td align="right" className="tnum font-medium">
                  {pct(entry.metrics.hitRate)}
                </Td>
                <Td align="right" className={cn("tnum", returnTone(entry.metrics.averageReturn))}>
                  {signedPct(entry.metrics.averageReturn)}
                </Td>
                <Td align="right" className={cn("tnum", returnTone(entry.metrics.averageAlpha))}>
                  {signedPct(entry.metrics.averageAlpha)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.brierScore.toFixed(3)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {entry.metrics.calibrationError.toFixed(3)}
                </Td>
                <Td align="right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="tnum text-sm font-semibold">{entry.score.toFixed(1)}</span>
                    <Meter
                      value={entry.score / 100}
                      tone={entry.rank === 1 ? "metal" : "accent"}
                      className="w-16"
                    />
                  </div>
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
                  <p className="truncate text-sm font-medium">{entry.student.name}</p>
                  <p className="truncate text-[11px] text-fg-muted">
                    {entry.modelVersion?.name ?? "—"} · n={entry.metrics.resolvedPredictions}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-base font-semibold">{entry.score.toFixed(1)}</p>
                  <RankDelta rank={entry.rank} previous={entry.previousRank} />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-2.5">
                <MobileMetric label="Hit" value={pct(entry.metrics.hitRate, 0)} />
                <MobileMetric
                  label="Return"
                  value={signedPct(entry.metrics.averageReturn, 1)}
                  tone={returnTone(entry.metrics.averageReturn)}
                />
                <MobileMetric
                  label="Alpha"
                  value={signedPct(entry.metrics.averageAlpha, 1)}
                  tone={returnTone(entry.metrics.averageAlpha)}
                />
                <MobileMetric label="Brier" value={entry.metrics.brierScore.toFixed(3)} />
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-fg-subtle sm:px-6">
        Students with fewer than {LEADERBOARD_CONFIG.minResolvedForRanking} resolved predictions are
        marked provisional and listed after the ranked cohort. Sample size is always shown so a
        single lucky call is never mistaken for a record.
      </p>
    </>
  );
}

function MobileMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={cn("tnum text-xs font-medium", tone)}>{value}</dd>
    </div>
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
