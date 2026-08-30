import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  Avatar,
  Badge,
  Meter,
  Panel,
  SectionHeading,
  Stat,
} from "@/components/ui/primitives";
import { LEADERBOARD_CONFIG } from "@/config/leaderboard";
import { getLeaderboard, getOverview } from "@/lib/data/queries";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Students",
  description: "Every participant, their points and their record so far.",
};

export default async function StudentsPage() {
  const [entries, overview] = await Promise.all([getLeaderboard(), getOverview()]);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Cohort"
        title="Students"
        description="Ranked by points: one per stock that reached +10% at the deadline."
      />

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Stat label="Students" value={overview.students} hint={`${overview.totalCycles} cycles run`} />
        <Stat
          label="Ranked"
          value={entries.filter((entry) => !entry.provisional).length}
          hint={`≥ ${LEADERBOARD_CONFIG.minResolvedForRanking} resolved predictions`}
        />
        <Stat
          label="Points awarded"
          value={entries.reduce((sum, entry) => sum + entry.score, 0)}
          hint={`${overview.resolvedPredictions} resolved picks`}
        />
      </dl>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.student.id}>
            <Link
              href={`/students/${entry.student.id}`}
              className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-panel)] transition-colors hover:border-border-strong hover:bg-surface-hover"
            >
              <div className="flex items-start gap-3">
                <Avatar name={entry.student.name} seed={entry.student.avatarSeed} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{entry.student.name}</p>
                    <ArrowUpRight className="size-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-accent-fg" />
                  </div>
                  <p className="truncate font-mono text-[11px] text-fg-subtle">
                    {entry.student.handle}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-lg font-semibold leading-none">{entry.score}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
                    {entry.provisional ? "provisional" : `rank ${entry.rank}`}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-fg-muted">
                    {entry.modelVersion?.name ?? "No model registered"}
                  </span>
                  {entry.modelVersion ? (
                    <Badge tone="accent">{entry.modelVersion.researchArea}</Badge>
                  ) : null}
                </div>
                <Meter
                  value={entry.metrics.hitRate}
                  tone={entry.rank === 1 && !entry.provisional ? "metal" : "accent"}
                  className="mt-2"
                />
              </div>

              <dl className="grid grid-cols-4 gap-2 border-t border-border pt-3">
                <MiniStat label="n" value={String(entry.metrics.resolvedPredictions)} />
                <MiniStat label="Hits" value={String(entry.metrics.hits)} />
                <MiniStat label="Hit" value={pct(entry.metrics.hitRate, 0)} />
                <MiniStat
                  label="Return"
                  value={signedPct(entry.metrics.averageReturn, 1)}
                  tone={returnTone(entry.metrics.averageReturn)}
                />
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <Panel className="px-4 py-3.5 sm:px-6">
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          Ranking is recomputed on every request from the immutable snapshots — nothing here is
          cached from a previous week, and no student can change a past prediction.
        </p>
      </Panel>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={cn("tnum text-xs font-medium", tone)}>{value}</dd>
    </div>
  );
}
