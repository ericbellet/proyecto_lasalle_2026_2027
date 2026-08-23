import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Unlock } from "lucide-react";

import {
  Badge,
  Meter,
  Panel,
  PanelHeader,
  SectionHeading,
  Stat,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { getCycleSummaries, getOverview } from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "History",
  description: "Every prediction cycle since the start of the course.",
};

export default async function HistoryPage() {
  const [cycles, overview] = await Promise.all([getCycleSummaries(), getOverview()]);
  const resolvedCycles = cycles.filter((cycle) => cycle.resolved > 0);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Archive"
        title="Prediction cycles"
        description="Nothing is ever deleted. Every cycle keeps its own locked snapshots, which is what makes the whole leaderboard auditable after the fact."
      />

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Cycles" value={cycles.length} hint={`${resolvedCycles.length} with resolutions`} />
        <Stat
          label="Predictions"
          value={overview.totalPredictions}
          hint={`${overview.activePredictions} awaiting the market`}
        />
        <Stat label="Resolved" value={overview.resolvedPredictions} hint="Outcome is known" />
        <Stat
          label="Cohort hit rate"
          value={pct(overview.hitRate)}
          hint="Across the whole archive"
        />
      </dl>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="All cycles"
          description="Newest first. The weekly winner is the student with the most hits resolved from that cycle."
        />
        <TableShell minWidth={880}>
          <thead>
            <tr>
              <Th>Cycle</Th>
              <Th>Deadline</Th>
              <Th>Area</Th>
              <Th align="right">Students</Th>
              <Th align="right">Predictions</Th>
              <Th align="right">Resolved</Th>
              <Th align="right">Hit rate</Th>
              <Th align="right">Avg return</Th>
              <Th>Weekly winner</Th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((summary) => (
              <tr key={summary.cycle.id} className="transition-colors hover:bg-surface-hover">
                <Td>
                  <div className="flex items-center gap-2">
                    {summary.cycle.lockedAt ? (
                      <Lock className="size-3 shrink-0 text-fg-subtle" />
                    ) : (
                      <Unlock className="size-3 shrink-0 text-cyan" />
                    )}
                    <span className="tnum text-xs font-medium">{summary.cycle.id}</span>
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs text-fg-muted">
                  {formatDate(summary.cycle.deadlineAt)}
                </Td>
                <Td>
                  <Badge tone="accent">{summary.area}</Badge>
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {summary.students}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {summary.predictions}
                </Td>
                <Td align="right" className="tnum text-fg-muted">
                  {summary.resolved}
                </Td>
                <Td align="right">
                  {summary.hitRate === null ? (
                    <span className="text-fg-subtle">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span className="tnum text-xs font-medium">{pct(summary.hitRate, 0)}</span>
                      <Meter value={summary.hitRate} className="w-12" />
                    </div>
                  )}
                </Td>
                <Td align="right" className={cn("tnum", returnTone(summary.averageReturn))}>
                  {summary.averageReturn === null ? "—" : signedPct(summary.averageReturn)}
                </Td>
                <Td>
                  {summary.winner ? (
                    <Link
                      href={`/students/${summary.winner.studentId}`}
                      className="truncate text-xs font-medium hover:text-accent-fg"
                    >
                      {summary.winner.name}
                      <span className="ml-1.5 tnum text-[10px] text-fg-subtle">
                        {summary.winner.hits} hits
                      </span>
                    </Link>
                  ) : (
                    <span className="text-xs text-fg-subtle">Not resolved yet</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-fg-subtle sm:px-6">
          A cycle opens on Monday and locks at its deadline. Predictions inside a locked cycle
          resolve at different times — a 1W call from cycle {overview.currentCycle.id} resolves this
          month, while its 6M sibling resolves next semester.
        </p>
      </Panel>
    </div>
  );
}
