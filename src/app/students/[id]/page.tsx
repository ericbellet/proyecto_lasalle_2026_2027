import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Trophy } from "lucide-react";

import { CalibrationChart } from "@/components/charts/calibration-chart";
import { ModelEvolutionChart } from "@/components/charts/model-evolution-chart";
import { RankHistoryChart } from "@/components/charts/rank-history-chart";
import { PredictionsTable } from "@/components/predictions/predictions-table";
import {
  Avatar,
  Badge,
  Explain,
  Meter,
  Panel,
  PanelHeader,
  Stat,
} from "@/components/ui/primitives";
import { HORIZONS, HORIZON_LABELS, RESEARCH_AREA_LABELS, TARGET_RETURN } from "@/config/challenge";
import { SCORE_COMPONENT_LABELS, type ScoreComponent } from "@/config/leaderboard";
import { getStudentDetail, getStudents } from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { cn, pct, returnTone, signedPct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const detail = await getStudentDetail((await params).id);
  if (!detail) return { title: "Student not found" };
  return {
    title: detail.student.name,
    description: `${detail.student.name}'s prediction record: ${detail.metrics.resolvedPredictions} resolved predictions, ${pct(detail.metrics.hitRate)} hit rate.`,
  };
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getStudentDetail(id);
  if (!detail) notFound();

  const { metrics, entry } = detail;
  const cohort = (await getStudents()).length;
  const confidenceGap = metrics.averageProbability - metrics.hitRate;

  return (
    <div className="space-y-8">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> All students
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={detail.student.name} seed={detail.student.avatarSeed} size={60} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {detail.student.name}
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-fg-subtle">
              {detail.student.handle} · joined {formatDate(detail.student.joinedAt)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {entry?.modelVersion ? (
                <>
                  <Badge tone="accent">{entry.modelVersion.version}</Badge>
                  <span className="text-xs text-fg-muted">{entry.modelVersion.name}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <RankTile label="Current" value={entry?.provisional ? "—" : `#${entry?.rank ?? "—"}`} accent />
          <RankTile
            label="Previous"
            value={entry?.previousRank ? `#${entry.previousRank}` : "—"}
          />
          <RankTile label="Best" value={detail.bestRank ? `#${detail.bestRank}` : "—"} />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Pts"
          value={entry ? String(entry.score) : "—"}
          hint={entry?.provisional ? "Provisional" : "1 per +10% hit"}
        />
        <Stat label="Hit rate" value={pct(metrics.hitRate)} hint={`${metrics.hits} of ${metrics.resolvedPredictions}`} />
        <Stat
          label="Avg return"
          value={signedPct(metrics.averageReturn)}
          tone={returnTone(metrics.averageReturn)}
          hint={`Median ${signedPct(metrics.medianReturn)}`}
        />
        <Stat
          label="Avg alpha"
          value={signedPct(metrics.averageAlpha)}
          tone={returnTone(metrics.averageAlpha)}
          hint="vs equal-weight universe"
        />
        <Stat label="Brier" value={metrics.brierScore.toFixed(3)} hint="Lower is better · 0.25 = coin flip" />
        <Stat
          label="Predictions"
          value={metrics.totalPredictions}
          hint={`${metrics.activePredictions} still active`}
        />
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Calibration"
            description={
              Math.abs(confidenceGap) < 0.03
                ? "Stated confidence closely matches reality."
                : confidenceGap > 0
                  ? `States ${pct(metrics.averageProbability, 0)} on average but hits ${pct(metrics.hitRate, 0)} — overconfident by ${(confidenceGap * 100).toFixed(1)} points.`
                  : `States ${pct(metrics.averageProbability, 0)} on average but hits ${pct(metrics.hitRate, 0)} — underconfident by ${(Math.abs(confidenceGap) * 100).toFixed(1)} points.`
            }
          />
          <div className="p-4 sm:p-5">
            <CalibrationChart bins={detail.calibration} />
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Ranking evolution"
            description="Position in the cohort after each cycle."
          />
          <div className="p-4 sm:p-5">
            <RankHistoryChart history={detail.rankHistory} cohortSize={cohort} />
          </div>
        </Panel>
      </div>

      {entry ? (
        <Panel className="overflow-hidden">
          <PanelHeader
          title="Diagnostic breakdown"
          description="Brier, calibration and the rest stay here as analysis. They do not decide the ranking."
          />
          <ul className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(SCORE_COMPONENT_LABELS) as ScoreComponent[]).map((component) => {
              const value = entry.components[component] ?? 0;
              return (
                <li key={component} className="bg-surface px-4 py-3.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                    {SCORE_COMPONENT_LABELS[component]}
                  </p>
                  <p className="tnum mt-1 text-lg font-semibold">{(value * 100).toFixed(0)}</p>
                  <Meter value={value} className="mt-2" />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Model evolution"
          description="The central question of the course: did the machine learning model beat the weighted score, and did the agents beat the machine learning model?"
        />
        <div className="p-4 sm:p-5">
          <ModelEvolutionChart evolution={detail.evolution} />
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {detail.evolution.map((row) => (
            <li key={row.area} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 sm:px-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{row.area}</Badge>
                  <span className="truncate text-sm font-medium">
                    {row.modelVersion?.name ?? "Unnamed model"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                  {row.modelVersion?.approach ?? RESEARCH_AREA_LABELS[row.area]} · {row.cycles} cycles
                </p>
              </div>
              <dl className="flex shrink-0 gap-5">
                <EvolutionStat label="n" value={String(row.metrics.resolvedPredictions)} />
                <EvolutionStat label="Hit" value={pct(row.metrics.hitRate, 0)} />
                <EvolutionStat
                  label="Return"
                  value={signedPct(row.metrics.averageReturn, 1)}
                  tone={returnTone(row.metrics.averageReturn)}
                />
                <EvolutionStat label="Brier" value={row.metrics.brierScore.toFixed(3)} />
              </dl>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Per-horizon record"
          description={`A hit means the stock reached +${Math.round(TARGET_RETURN * 100)}% at any point inside the horizon.`}
        />
        <ul className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {HORIZONS.map((horizonKey) => {
            const row = detail.metricsByHorizon[horizonKey];
            return (
              <li key={horizonKey} className="bg-surface px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                  {HORIZON_LABELS[horizonKey]}
                </p>
                <p className="tnum mt-1.5 text-xl font-semibold">{pct(row.hitRate, 0)}</p>
                <p className="mt-1 text-[11px] text-fg-muted">
                  {row.hits}/{row.resolvedPredictions} resolved ·{" "}
                  <span className={returnTone(row.averageReturn)}>
                    {signedPct(row.averageReturn, 1)}
                  </span>
                </p>
                <Meter value={row.hitRate} className="mt-2.5" />
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Activity className="size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-[11px] leading-relaxed text-fg-subtle">
            <Explain term="Horizon diversity">
              How different the four horizon shortlists are from each other. 100% means twelve distinct tickers; 0% means the same three picked four times.
            </Explain>{" "}
            in the current cycle: <span className="tnum text-fg">{pct(detail.diversity, 0)}</span>
          </p>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Picks"
          description={`${detail.predictions.length} picks. Points are awarded when the deadline arrives, if the stock reached +${Math.round(TARGET_RETURN * 100)}%.`}
        />
        <PredictionsTable
          predictions={detail.predictions}
          show="ticker"
          emptyTitle="No picks yet"
        />
      </Panel>

      {detail.entry?.rank === 1 && !detail.entry.provisional ? (
        <p className="flex items-center justify-center gap-2 text-xs text-metal">
          <Trophy className="size-3.5" /> Currently leading the challenge
        </p>
      ) : null}
    </div>
  );
}

function RankTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "panel min-w-[74px] px-3 py-2.5 text-center",
        accent && "border-accent/35 bg-accent-soft",
      )}
    >
      <p className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className={cn("tnum mt-0.5 text-lg font-semibold", accent && "text-accent-fg")}>{value}</p>
    </div>
  );
}

function EvolutionStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-right">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={cn("tnum text-xs font-medium", tone)}>{value}</dd>
    </div>
  );
}
