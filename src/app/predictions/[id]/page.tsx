import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Lock, X } from "lucide-react";

import { PricePathChart } from "@/components/charts/price-path-chart";
import {
  Avatar,
  Badge,
  Panel,
  PanelHeader,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { HORIZON_LABELS, TARGET_RETURN } from "@/config/challenge";
import { getPredictionDetail, getStudents } from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { cn, money, num, pct, returnTone, signedPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const detail = await getPredictionDetail((await params).id);
  if (!detail) return { title: "Prediction not found" };
  return {
    title: `${detail.student.name} · ${detail.prediction.ticker} ${detail.prediction.horizon}`,
    description: `${detail.student.name} picked ${detail.prediction.ticker} for the ${detail.prediction.horizon} horizon.`,
  };
}

export default async function PredictionPage({ params }: { params: Promise<{ id: string }> }) {
  const detail = await getPredictionDetail((await params).id);
  if (!detail) notFound();

  const { prediction, student, cycle, snapshot, features } = detail;
  const result = prediction.result;
  const students = new Map((await getStudents()).map((entry) => [entry.id, entry]));

  return (
    <div className="space-y-8">
      <Link
        href={`/students/${student.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> {student.name}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={student.name} seed={student.avatarSeed} size={44} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {student.name} picked{" "}
              <span className="tnum">{prediction.ticker}</span>
            </h1>
            <p className="mt-1 text-xs text-fg-muted">
              Rank #{prediction.rank} of the {HORIZON_LABELS[prediction.horizon]} shortlist
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone="neutral">{cycle?.id ?? prediction.cycleId}</Badge>
          <Badge tone="accent">{prediction.horizon}</Badge>
          {prediction.sourceUrl ? (
            <a
              href={prediction.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-xs font-medium text-accent-fg transition-colors hover:border-accent-fg/40"
            >
              Watch source <ExternalLink className="size-3" />
            </a>
          ) : null}
          {result ? (
            result.hitTarget ? (
              <Badge tone="positive">Hit · +1 pt</Badge>
            ) : (
              <Badge tone="negative">Miss · 0 pts</Badge>
            )
          ) : (
            <Badge tone="cyan">Active · —</Badge>
          )}
        </div>
      </header>

      {/* The core visual: what was claimed, against what happened. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
        <Panel className="p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-fg">
            Pick
          </p>
          <p className="tnum mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {prediction.ticker}
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Rank #{prediction.rank} · {HORIZON_LABELS[prediction.horizon]} · +
            {Math.round(TARGET_RETURN * 100)}% by {formatDate(prediction.resolutionDate)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
            <Field label="Prediction date" value={formatDate(prediction.predictionDate)} />
            <Field label="Entry price" value={money(result?.predictionPrice)} />
            <Field label="Target price" value={money(prediction.targetPrice)} />
            <Field label="Horizon" value={HORIZON_LABELS[prediction.horizon]} />
          </dl>
        </Panel>

        <div className="grid place-items-center py-1 lg:py-0">
          <span className="rounded-full border border-border bg-bg-elevated px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle">
            versus
          </span>
        </div>

        <Panel
          className={cn(
            "p-5 sm:p-6",
            result && (result.hitTarget ? "border-positive/30" : "border-negative/30"),
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">Actual</p>
          {result ? (
            <>
              <p
                className={cn(
                  "tnum mt-3 flex items-center gap-2 text-4xl font-semibold tracking-tight sm:text-5xl",
                  returnTone(result.realizedReturn),
                )}
              >
                {signedPct(result.realizedReturn)}
                {result.hitTarget ? (
                  <Check className="size-7 shrink-0" />
                ) : (
                  <X className="size-7 shrink-0" />
                )}
              </p>
              <p className="mt-2 text-sm text-fg-muted">
                Benchmark returned{" "}
                <span className="tnum text-fg">{signedPct(result.benchmarkReturn)}</span> over the
                same window, so alpha was{" "}
                <span className={cn("tnum", returnTone(result.alpha))}>
                  {signedPct(result.alpha)}
                </span>
                .
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
                <Field label="Resolution date" value={formatDate(result.resolvedAt)} />
                <Field label="Exit price" value={money(result.resolutionPrice)} />
              </dl>
            </>
          ) : (
            <>
              <p className="tnum mt-3 text-4xl font-semibold tracking-tight text-fg-subtle sm:text-5xl">
                Pending
              </p>
              <p className="mt-2 text-sm text-fg-muted">
                Resolves on {formatDate(prediction.resolutionDate)}. The snapshot is already locked,
                so this number cannot be edited before the outcome is known.
              </p>
            </>
          )}
        </Panel>
      </div>

      {detail.path.length > 1 ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Price path"
            description="From the prediction date to the resolution date."
          />
          <div className="p-4 sm:p-5">
            <PricePathChart
              path={detail.path}
              entryPrice={result?.predictionPrice ?? detail.path[0]?.close ?? 0}
              targetReturn={TARGET_RETURN}
              hit={result ? result.hitTarget : null}
            />
          </div>
        </Panel>
      ) : null}

      {prediction.investmentThesis || prediction.risks ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {prediction.investmentThesis ? (
            <Panel>
              <PanelHeader title="Investment thesis" description="Submitted with the prediction." />
              <p className="px-4 py-4 text-sm leading-relaxed text-fg-muted sm:px-6">
                {prediction.investmentThesis}
              </p>
            </Panel>
          ) : null}
          {prediction.risks ? (
            <Panel>
              <PanelHeader title="Stated risks" description="What the model flagged against itself." />
              <p className="px-4 py-4 text-sm leading-relaxed text-fg-muted sm:px-6">
                {prediction.risks}
              </p>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {features ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Information available at prediction time"
            description="The feature row the model could legitimately see. Anything dated after this is look-ahead bias."
          />
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
            <FeatureCell label="Close" value={money(features.close)} />
            <FeatureCell label="P/E" value={num(features.peRatio, 1)} />
            <FeatureCell label="Rev. growth" value={signedPct(features.revenueGrowthYoy)} />
            <FeatureCell label="ROIC" value={pct(features.roic)} />
            <FeatureCell label="Momentum 3M" value={signedPct(features.momentum3m)} />
            <FeatureCell label="Baseline" value={num(features.baselineInvestmentScore, 1)} />
          </div>
        </Panel>
      ) : null}

      {detail.peers.length > 0 ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Other students on the same call"
            description={`Same ticker, same cycle, same ${prediction.horizon} horizon.`}
          />
          <TableShell minWidth={520}>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th align="right">Rank</Th>
                <Th align="right">Realized</Th>
              </tr>
            </thead>
            <tbody>
              {detail.peers.map((peer) => (
                <tr key={peer.id} className="transition-colors hover:bg-surface-hover">
                  <Td>
                    <Link href={`/predictions/${peer.id}`} className="hover:text-accent-fg">
                      {students.get(peer.studentId)?.name ?? peer.studentId}
                    </Link>
                  </Td>
                  <Td align="right" className="tnum text-fg-muted">
                    {peer.rank}
                  </Td>
                  <Td
                    align="right"
                    className={cn(
                      "tnum",
                      peer.result ? returnTone(peer.result.realizedReturn) : "text-fg-subtle",
                    )}
                  >
                    {peer.result ? signedPct(peer.result.realizedReturn) : "active"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      {snapshot ? (
        <Panel className="px-4 py-3.5 sm:px-6">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            <Lock className="size-3" />
            Snapshot {snapshot.payloadHash.slice(0, 12)} · fetched{" "}
            {formatDate(snapshot.fetchedAt)}
            {snapshot.lockedAt ? ` · locked ${formatDate(snapshot.lockedAt)}` : " · not locked"}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="tnum mt-0.5 text-xs font-medium">{value}</dd>
    </div>
  );
}

function FeatureCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="tnum mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
