import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { Champion } from "@/components/leaderboard/champion";
import { WeeklyPodium } from "@/components/leaderboard/weekly-podium";
import { InsightList } from "@/components/common/insight-list";
import { DotMatrix } from "@/components/ui/dot-matrix";
import {
  Badge,
  LinkButton,
  Panel,
  PanelHeader,
  SectionHeading,
  Stat,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { RESEARCH_AREA_LABELS, TARGET_RETURN } from "@/config/challenge";
import { site } from "@/config/site";
import {
  getConsensus,
  getInsights,
  getLeaderboard,
  getOverview,
  getWeeklyPodium,
} from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

export default async function HomePage() {
  const [overview, leaderboard, insights, podium, consensus] = await Promise.all([
    getOverview(),
    getLeaderboard(),
    getInsights(),
    getWeeklyPodium(),
    getConsensus(),
  ]);

  const ranked = leaderboard.filter((entry) => !entry.provisional);

  return (
    <div className="space-y-12">
      <Hero overview={overview} />

      <section>
        <SectionHeading
          eyebrow="Standings"
          title="Championship leaders"
          description="Ranked on hit rate, calibration, relative return, consistency and sample size — all measured against the cohort."
          action={
            <LinkButton href="/leaderboard" variant="secondary" size="sm">
              Full leaderboard <ArrowRight className="size-3.5" />
            </LinkButton>
          }
        />
        <Champion entries={ranked.slice(0, 3)} celebrate />
      </section>

      {insights.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="Automatic analysis"
            title="What the data says this week"
            description="Rule-based observations computed from resolved predictions. No language model is involved — every sentence is a number the platform already calculated."
          />
          <InsightList insights={insights} />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {podium ? <WeeklyPodium cycle={podium.cycle} podium={podium.podium} /> : null}

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Highest consensus this cycle"
            description="Companies the cohort agrees on, and the ones it does not."
            action={
              <Link href="/consensus" className="text-xs text-accent-fg hover:underline">
                All consensus
              </Link>
            }
          />
          <TableShell minWidth={340}>
            <thead>
              <tr>
                <Th>Stock</Th>
                <Th align="right">Students</Th>
                <Th align="right">Avg prob.</Th>
                <Th align="right">Spread</Th>
              </tr>
            </thead>
            <tbody>
              {consensus.slice(0, 6).map((row) => (
                <tr key={row.ticker} className="transition-colors hover:bg-surface-hover">
                  <Td>
                    <Link
                      href={`/stocks/${row.ticker}`}
                      className="flex items-center gap-2 hover:text-accent-fg"
                    >
                      <span className="tnum text-xs font-semibold">{row.ticker}</span>
                      <span className="hidden truncate text-xs text-fg-muted sm:inline">
                        {row.stock.companyName}
                      </span>
                    </Link>
                  </Td>
                  <Td align="right" className="tnum text-fg-muted">
                    {row.studentCount}/{overview.students}
                  </Td>
                  <Td align="right" className="tnum font-medium">
                    {pct(row.averageProbability, 0)}
                  </Td>
                  <Td align="right" className="tnum text-fg-muted">
                    ±{pct(row.probabilityStdDev, 0)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      </div>

      <section>
        <SectionHeading
          eyebrow="Full standings"
          title="Every student"
          description="Sample size is always visible. A student needs resolved predictions, not one lucky call."
        />
        <Panel className="overflow-hidden">
          <TableShell minWidth={560}>
            <thead>
              <tr>
                <Th className="w-12">#</Th>
                <Th>Student</Th>
                <Th className="hidden sm:table-cell">Model</Th>
                <Th align="right">n</Th>
                <Th align="right">Hit rate</Th>
                <Th align="right">Avg return</Th>
                <Th align="right">Score</Th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.student.id} className="transition-colors hover:bg-surface-hover">
                  <Td className="tnum text-fg-subtle">{entry.provisional ? "—" : entry.rank}</Td>
                  <Td>
                    <Link
                      href={`/students/${entry.student.id}`}
                      className="font-medium hover:text-accent-fg"
                    >
                      {entry.student.name}
                    </Link>
                  </Td>
                  <Td className="hidden text-xs text-fg-muted sm:table-cell">
                    {entry.modelVersion?.name ?? "—"}
                  </Td>
                  <Td align="right" className="tnum text-fg-muted">
                    {entry.metrics.resolvedPredictions}
                  </Td>
                  <Td align="right" className="tnum">
                    {pct(entry.metrics.hitRate)}
                  </Td>
                  <Td align="right" className={cn("tnum", returnTone(entry.metrics.averageReturn))}>
                    {signedPct(entry.metrics.averageReturn)}
                  </Td>
                  <Td align="right" className="tnum font-semibold">
                    {entry.score.toFixed(1)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      </section>
    </div>
  );
}

function Hero({ overview }: { overview: Awaited<ReturnType<typeof getOverview>> }) {
  return (
    <section className="relative -mx-4 overflow-hidden border-b border-border px-4 pb-8 pt-4 sm:-mx-6 sm:px-6 sm:pb-10">
      <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            <Sparkles className="size-3" /> {RESEARCH_AREA_LABELS[overview.currentArea]}
          </Badge>
          <Badge tone={overview.currentCycle.status === "open" ? "cyan" : "neutral"}>
            {overview.currentCycle.status === "open" ? "Cycle open" : "Cycle locked"}
          </Badge>
        </div>

        <h1 className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          <span className="text-gradient">Value Investing Challenge</span>
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-fg-muted sm:text-base">
          {site.tagline} Sixteen students, four horizons, one rule: every prediction is recorded
          before anyone knows the outcome.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LinkButton href="/leaderboard" variant="primary" size="md">
            View leaderboard <ArrowRight className="size-4" />
          </LinkButton>
          <LinkButton href="/integrate" variant="secondary" size="md">
            Connect your model
          </LinkButton>
          <div className="hidden items-center gap-2.5 pl-2 lg:flex">
            <DotMatrix count={16} columns={8} />
            <span className="font-mono text-[11px] text-fg-subtle">
              {overview.students} student models tracked
            </span>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Current cycle"
            value={overview.currentCycle.id}
            hint={`Locks ${formatDate(overview.currentCycle.deadlineAt)}`}
          />
          <Stat label="Students" value={overview.students} hint={`${overview.totalCycles} cycles run`} />
          <Stat
            label="Active models"
            value={overview.activeModels}
            hint="Submitting this cycle"
          />
          <Stat
            label="Active predictions"
            value={overview.activePredictions}
            hint="Locked, awaiting the market"
          />
          <Stat
            label="Resolved"
            value={overview.resolvedPredictions}
            hint={`${pct(overview.hitRate)} reached +${pct(TARGET_RETURN, 0)}`}
          />
          <Stat
            label="Avg return"
            value={signedPct(overview.averageReturn)}
            tone={returnTone(overview.averageReturn)}
            hint="Across resolved picks"
          />
        </dl>

        <p className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
          <Lock className="size-3" /> Snapshots are immutable once locked
        </p>
      </div>
    </section>
  );
}
