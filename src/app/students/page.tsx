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
import { getLeaderboard, getOverview, getStudents } from "@/lib/data/queries";
import type { LeaderboardEntry } from "@/lib/types";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Students",
  description: "Every participant, their points and their record so far.",
};

export default async function StudentsPage() {
  const [entries, people, overview] = await Promise.all([
    getLeaderboard(),
    getStudents(),
    getOverview(),
  ]);
  const byId = new Map(entries.map((entry) => [entry.student.id, entry]));
  const cards: LeaderboardEntry[] = people.map((person) => {
    const existing = byId.get(person.id);
    if (existing) return existing;
    return {
      rank: entries.length + 1,
      previousRank: null,
      student: person,
      modelVersion: null,
      metrics: {
        studentId: person.id,
        totalPredictions: 0,
        resolvedPredictions: 0,
        activePredictions: 0,
        hits: 0,
        hitRate: 0,
        averageReturn: 0,
        medianReturn: 0,
        bestReturn: 0,
        worstReturn: 0,
        averageAlpha: 0,
        averageProbability: 0,
        brierScore: 0,
        calibrationError: 0,
        consistency: 0,
      },
      score: 0,
      components: {},
      provisional: true,
    };
  });
  const students = cards.filter((entry) => entry.student.kind !== "influencer");
  const influencers = cards.filter((entry) => entry.student.kind === "influencer");

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Cohort"
        title="Students & influencers"
        description="Class endpoints and YouTube influencers, ranked by the same rule: one point per stock that reached +10% at the deadline."
      />

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Stat
          label="Participants"
          value={people.length}
          hint={`${overview.totalCycles} cycles run`}
        />
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

      <ParticipantSection
        id="students"
        title="Students"
        description="Models submitted by the class through their own prediction APIs."
        entries={students}
      />

      <ParticipantSection
        id="influencers"
        title="Influencers"
        description="Public investing voices evaluated under the same deadlines and scoring rule."
        entries={influencers}
      />

      <Panel className="px-4 py-3.5 sm:px-6">
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          Ranking is recomputed on every request from the immutable snapshots — nothing here is
          cached from a previous week, and no student can change a past prediction.
        </p>
      </Panel>
    </div>
  );
}

function ParticipantSection({
  id,
  title,
  description,
  entries,
}: {
  id: string;
  title: string;
  description: string;
  entries: LeaderboardEntry[];
}) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-fg-muted">{description}</p>
      </div>
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
                    {entry.student.kind === "influencer" ? <Badge tone="cyan">influencer</Badge> : null}
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
    </section>
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
