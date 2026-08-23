import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Split, TrendingDown, TrendingUp } from "lucide-react";

import {
  Badge,
  Explain,
  Meter,
  Panel,
  PanelHeader,
  SectionHeading,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { HORIZONS } from "@/config/challenge";
import { getConsensus, getConsensusShifts, getOverview } from "@/lib/data/queries";
import { cn, pct, signedPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Consensus",
  description:
    "Where the cohort agrees, where it splits, and which way collective sentiment moved this week.",
};

export default async function ConsensusPage() {
  const [rows, shifts, overview] = await Promise.all([
    getConsensus(),
    getConsensusShifts(),
    getOverview(),
  ]);

  const cohort = overview.students;
  const highestConfidence = [...rows].sort((a, b) => b.averageProbability - a.averageProbability);
  const controversial = [...rows]
    .filter((row) => row.predictionCount >= 3)
    .sort((a, b) => b.probabilityStdDev - a.probabilityStdDev);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={`Cycle ${overview.currentCycle.id}`}
        title="Market consensus"
        description="Sixteen independent systems looking at the same ten companies. Where they agree is interesting; where they disagree is more interesting."
      />

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Most selected"
          description="Every ticker picked by at least one student in the current cycle."
        />
        <TableShell minWidth={780}>
          <thead>
            <tr>
              <Th>Stock</Th>
              <Th align="right">Students</Th>
              <Th align="right">Picks</Th>
              <Th align="right">
                <Explain term="Avg prob.">
                  Mean stated probability of reaching +10% inside the horizon, across every prediction on this ticker.
                </Explain>
              </Th>
              <Th align="right">
                <Explain term="Spread">
                  Standard deviation of those probabilities. A large spread means the cohort genuinely disagrees rather than all copying the same signal.
                </Explain>
              </Th>
              <Th align="right">Exp. return</Th>
              {HORIZONS.map((horizon) => (
                <Th key={horizon} align="right" className="hidden lg:table-cell">
                  {horizon}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="transition-colors hover:bg-surface-hover">
                <Td>
                  <Link href={`/stocks/${row.ticker}`} className="group block">
                    <span className="tnum text-sm font-semibold transition-colors group-hover:text-accent-fg">
                      {row.ticker}
                    </span>
                    <span className="ml-2 hidden text-xs text-fg-muted xl:inline">
                      {row.stock.companyName}
                    </span>
                  </Link>
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="tnum text-xs">
                      {row.studentCount}/{cohort}
                    </span>
                    <Meter
                      value={row.studentCount / cohort}
                      className="w-12"
                      tone={row.studentCount / cohort > 0.6 ? "metal" : "accent"}
                    />
                  </div>
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {row.predictionCount}
                </Td>
                <Td align="right" className="tnum font-medium">
                  {pct(row.averageProbability, 0)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  ±{pct(row.probabilityStdDev, 0)}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {signedPct(row.averageExpectedReturn)}
                </Td>
                {HORIZONS.map((horizon) => (
                  <Td
                    key={horizon}
                    align="right"
                    className="tnum hidden text-fg-subtle lg:table-cell"
                  >
                    {row.byHorizon[horizon] || "·"}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Highest confidence"
            description="Where the cohort is most sure — and therefore most exposed if it is wrong."
          />
          <ul className="divide-y divide-border">
            {highestConfidence.slice(0, 5).map((row) => (
              <li key={row.ticker}>
                <Link
                  href={`/stocks/${row.ticker}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-6"
                >
                  <Flame className="size-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-medium">{row.ticker}</p>
                    <p className="truncate text-[11px] text-fg-muted">{row.stock.companyName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-sm font-semibold">{pct(row.averageProbability, 0)}</p>
                    <p className="text-[10px] text-fg-subtle">{row.studentCount} students</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Most controversial"
            description="Largest disagreement between models looking at identical data."
          />
          <ul className="divide-y divide-border">
            {controversial.slice(0, 5).map((row) => (
              <li key={row.ticker}>
                <Link
                  href={`/stocks/${row.ticker}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-6"
                >
                  <Split className="size-4 shrink-0 text-accent-fg" />
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-medium">{row.ticker}</p>
                    <p className="truncate text-[11px] text-fg-muted">
                      {pct(row.minProbability, 0)} to {pct(row.maxProbability, 0)} across{" "}
                      {row.predictionCount} predictions
                    </p>
                  </div>
                  <Badge tone="accent">±{pct(row.probabilityStdDev, 0)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {shifts.length > 0 ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Biggest sentiment shifts"
            description="Change in average stated probability against the previous cycle."
          />
          <ul className="divide-y divide-border">
            {shifts.slice(0, 6).map((shift) => {
              const up = shift.delta >= 0;
              return (
                <li key={shift.ticker}>
                  <Link
                    href={`/stocks/${shift.ticker}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-6"
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md border",
                        up
                          ? "border-positive/30 bg-positive-soft text-positive"
                          : "border-negative/30 bg-negative-soft text-negative",
                      )}
                    >
                      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="tnum text-sm font-medium">{shift.ticker}</p>
                      <p className="truncate text-[11px] text-fg-muted">
                        {pct(shift.previous, 0)} → {pct(shift.current, 0)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "tnum shrink-0 text-sm font-semibold",
                        up ? "text-positive" : "text-negative",
                      )}
                    >
                      {signedPct(shift.delta, 0)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
