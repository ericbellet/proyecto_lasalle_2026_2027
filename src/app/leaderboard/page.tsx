import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { Champion } from "@/components/leaderboard/champion";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { FilterPills } from "@/components/ui/filter-pills";
import { Badge, Panel, PanelHeader, SectionHeading, Stat } from "@/components/ui/primitives";
import { HORIZON_LABELS, RESEARCH_AREA_LABELS } from "@/config/challenge";
import {
  LEADERBOARD_CONFIG,
  SCORE_COMPONENT_LABELS,
  SCORE_WEIGHTS,
  type ScoreComponent,
} from "@/config/leaderboard";
import { getAwards, getLeaderboard } from "@/lib/data/queries";
import {
  AREA_OPTIONS,
  HORIZON_OPTIONS,
  WINDOW_OPTIONS,
  flatten,
  parseArea,
  parseHorizon,
  parseWindow,
  type RawSearchParams,
} from "@/lib/data/search-params";
import { pct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Every student ranked on hit rate, calibration, relative return, consistency and sample size.",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = flatten(await searchParams);
  const horizon = parseHorizon(raw.horizon);
  const window = parseWindow(raw.window);
  const area = parseArea(raw.area);

  const [entries, awards] = await Promise.all([
    getLeaderboard({ horizon, window, researchArea: area }),
    getAwards(),
  ]);

  const ranked = entries.filter((entry) => !entry.provisional);
  const resolved = entries.reduce((sum, entry) => sum + entry.metrics.resolvedPredictions, 0);
  const hits = entries.reduce((sum, entry) => sum + entry.metrics.hits, 0);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Standings"
        title="Leaderboard"
        description="One score, five components, all measured against the cohort rather than against an absolute bar. Filter by horizon, by time window, or by the research area the model belongs to."
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          options={HORIZON_OPTIONS}
          active={horizon}
          paramName="horizon"
          searchParams={raw}
          basePath="/leaderboard"
          label="Horizon"
        />
        <FilterPills
          options={WINDOW_OPTIONS}
          active={window}
          paramName="window"
          searchParams={raw}
          basePath="/leaderboard"
          size="sm"
          label="Window"
        />
        <FilterPills
          options={AREA_OPTIONS}
          active={area}
          paramName="area"
          searchParams={raw}
          basePath="/leaderboard"
          size="sm"
          label="Models"
        />
      </div>

      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label="Scope"
          value={horizon === "OVERALL" ? "All horizons" : HORIZON_LABELS[horizon]}
          hint={area === "ALL" ? "Every model generation" : RESEARCH_AREA_LABELS[area]}
        />
        <Stat label="Ranked" value={ranked.length} hint={`${entries.length} students with picks`} />
        <Stat
          label="Resolved"
          value={resolved}
          hint={`${hits} reached the +10% target`}
        />
        <Stat
          label="Cohort hit rate"
          value={resolved ? pct(hits / resolved) : "—"}
          hint="Baseline every score is measured against"
        />
      </dl>

      {ranked.length > 0 ? <Champion entries={ranked.slice(0, 3)} /> : null}

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Full ranking"
          description={`Provisional below ${LEADERBOARD_CONFIG.minResolvedForRanking} resolved predictions.`}
          action={
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(SCORE_WEIGHTS) as Array<[ScoreComponent, number]>).map(
                ([component, weight]) => (
                  <Badge key={component} tone="accent">
                    {Math.round(weight * 100)}% {SCORE_COMPONENT_LABELS[component]}
                  </Badge>
                ),
              )}
            </div>
          }
        />
        <LeaderboardTable entries={entries} />
      </Panel>

      {awards.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="Categories"
            title="Beyond the overall score"
            description="One blended number hides the trade-offs. These categories surface the students who are best at one specific thing."
          />
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {awards.map((award) => (
              <li key={award.id}>
                <Link
                  href={`/students/${award.studentId}`}
                  className="panel flex h-full items-start gap-3 p-4 transition-colors hover:bg-surface-hover"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-metal/35 bg-metal/10 text-metal">
                    <Trophy className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                      {award.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium">{award.studentName}</p>
                    <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                      {award.description} · <span className="tnum text-fg">{award.value}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
