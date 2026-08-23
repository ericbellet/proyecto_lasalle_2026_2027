import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { StockTimelineChart } from "@/components/charts/stock-timeline-chart";
import { PredictionsTable } from "@/components/predictions/predictions-table";
import { FilterPills } from "@/components/ui/filter-pills";
import {
  Badge,
  Meter,
  Panel,
  PanelHeader,
  Stat,
  Td,
  Th,
  TableShell,
} from "@/components/ui/primitives";
import { HORIZONS } from "@/config/challenge";
import { getStockDetail, getStocks, getStudents } from "@/lib/data/queries";
import { flatten, parseHorizon, type RawSearchParams } from "@/lib/data/search-params";
import { cn, compactNumber, money, num, pct, returnTone, signedPct } from "@/lib/utils";

export async function generateStaticParams() {
  const stocks = await getStocks();
  return stocks.map((stock) => ({ ticker: stock.ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const detail = await getStockDetail((await params).ticker);
  if (!detail) return { title: "Stock not found" };
  return {
    title: `${detail.stock.ticker} · ${detail.stock.companyName}`,
    description: `Student consensus and prediction history for ${detail.stock.companyName}.`,
  };
}

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { ticker } = await params;
  const raw = flatten(await searchParams);
  const horizon = parseHorizon(raw.horizon);

  const detail = await getStockDetail(ticker);
  if (!detail) notFound();

  const students = new Map((await getStudents()).map((student) => [student.id, student]));
  const cohortSize = students.size;
  const { stock, latest, consensus } = detail;

  const filtered = detail.predictions.filter(
    (prediction) => horizon === "OVERALL" || prediction.horizon === horizon,
  );

  return (
    <div className="space-y-8">
      <Link
        href="/stocks"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" /> All stocks
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tnum text-3xl font-semibold tracking-tight">{stock.ticker}</h1>
            <Badge tone="neutral">{stock.sector}</Badge>
            {latest ? (
              <Badge tone={latest.marketRegime === "risk-on" ? "positive" : latest.marketRegime === "risk-off" ? "negative" : "neutral"}>
                {latest.marketRegime}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-fg-muted">
            {stock.companyName} · {stock.industry} · {stock.country}
          </p>
          <p className="mt-1 font-mono text-[11px] text-fg-subtle">
            {compactNumber(stock.marketCap)} market cap · {compactNumber(stock.employees)} employees
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="tnum text-3xl font-semibold tracking-tight">{money(latest?.close)}</p>
          <p className={cn("tnum text-xs", returnTone(latest?.return1m))}>
            {signedPct(latest?.return1m)} past month
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Selected by"
          value={`${consensus?.studentCount ?? 0}/${cohortSize}`}
          hint="Students, current cycle"
        />
        <Stat
          label="Avg probability"
          value={consensus ? pct(consensus.averageProbability, 0) : "—"}
          hint={consensus ? `Median ${pct(consensus.medianProbability, 0)}` : "Not picked this cycle"}
        />
        <Stat
          label="Spread"
          value={consensus ? `±${pct(consensus.probabilityStdDev, 0)}` : "—"}
          hint={
            consensus
              ? `${pct(consensus.minProbability, 0)} to ${pct(consensus.maxProbability, 0)}`
              : undefined
          }
        />
        <Stat label="Baseline score" value={num(latest?.baselineInvestmentScore, 1)} hint="Reference formula" />
        <Stat
          label="Analyst upside"
          value={signedPct(latest?.targetUpside)}
          tone={returnTone(latest?.targetUpside)}
          hint={latest ? `${latest.numberOfAnalysts} analysts` : undefined}
        />
        <Stat
          label="Historic hit rate"
          value={consensus?.resolvedHitRate !== null && consensus?.resolvedHitRate !== undefined ? pct(consensus.resolvedHitRate, 0) : "—"}
          hint="Resolved picks on this ticker"
        />
      </dl>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Cohort confidence versus price"
          description="Whether the students' collective opinion led the price or followed it."
        />
        <div className="p-4 sm:p-5">
          <StockTimelineChart timeline={detail.timeline} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Fundamentals" description="As of the latest snapshot date." />
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
            <MetricGroup
              title="Valuation"
              rows={[
                ["P/E", num(latest?.peRatio, 1)],
                ["Forward P/E", num(latest?.forwardPe, 1)],
                ["EV/EBITDA", num(latest?.evEbitda, 1)],
                ["Price/Sales", num(latest?.priceToSales, 1)],
                ["FCF yield", pct(latest?.fcfYield)],
              ]}
            />
            <MetricGroup
              title="Growth"
              rows={[
                ["Revenue YoY", signedPct(latest?.revenueGrowthYoy)],
                ["EPS YoY", signedPct(latest?.epsGrowthYoy)],
                ["EBITDA YoY", signedPct(latest?.ebitdaGrowthYoy)],
                ["FCF YoY", signedPct(latest?.fcfGrowthYoy)],
                ["vs peers", signedPct(latest?.growthVsPeers)],
              ]}
            />
            <MetricGroup
              title="Profitability"
              rows={[
                ["Gross margin", pct(latest?.grossMargin)],
                ["Operating margin", pct(latest?.operatingMargin)],
                ["Net margin", pct(latest?.netMargin)],
                ["ROE", pct(latest?.roe)],
                ["ROIC", pct(latest?.roic)],
              ]}
            />
            <MetricGroup
              title="Financial health"
              rows={[
                ["Debt/Equity", num(latest?.debtToEquity, 2)],
                ["Net debt/EBITDA", num(latest?.netDebtEbitda, 2)],
                ["Current ratio", num(latest?.currentRatio, 2)],
                ["Interest coverage", num(latest?.interestCoverage, 1)],
                ["Cash", compactNumber(latest?.cash)],
              ]}
            />
            <MetricGroup
              title="Momentum"
              rows={[
                ["1 week", signedPct(latest?.momentum1w)],
                ["1 month", signedPct(latest?.momentum1m)],
                ["3 months", signedPct(latest?.momentum3m)],
                ["6 months", signedPct(latest?.momentum6m)],
                ["Volatility 30d", pct(latest?.volatility30d)],
              ]}
            />
            <MetricGroup
              title="Earnings & sentiment"
              rows={[
                ["EPS surprise", signedPct(latest?.epsSurprisePct)],
                ["Guidance", latest?.guidanceDirection ?? "—"],
                ["News 7d", num(latest?.newsSentiment7d, 2)],
                ["News 30d", num(latest?.newsSentiment30d, 2)],
                ["Upgrades − downgrades", latest ? String(latest.analystUpgrades30d - latest.analystDowngrades30d) : "—"],
              ]}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader title="Derived scores" description="The reference baseline given to students." />
            <ul className="space-y-3 p-4 sm:p-5">
              {latest
                ? (
                    [
                      ["Valuation", latest.valuationScore],
                      ["Growth", latest.growthScore],
                      ["Quality", latest.qualityScore],
                      ["Financial health", latest.financialHealthScore],
                      ["Momentum", latest.momentumScore],
                      ["Earnings", latest.earningsScore],
                    ] as Array<[string, number]>
                  ).map(([label, value]) => (
                    <li key={label}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-fg-muted">{label}</span>
                        <span className="tnum font-medium">{value.toFixed(1)}</span>
                      </div>
                      <Meter value={value / 100} className="mt-1.5" />
                    </li>
                  ))
                : null}
            </ul>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Peers" description="Comparison group used by the relative features." />
            <ul className="divide-y divide-border">
              {detail.peers.map((peer) => (
                <li key={peer.ticker}>
                  <Link
                    href={`/stocks/${peer.ticker}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-surface-hover sm:px-6"
                  >
                    <span className="tnum font-medium">{peer.ticker}</span>
                    <span className="truncate text-fg-muted">{peer.companyName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {consensus ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Horizon breakdown"
            description="How the cohort's picks are distributed across the four horizons this cycle."
          />
          <TableShell minWidth={420}>
            <thead>
              <tr>
                <Th>Horizon</Th>
                <Th align="right">Picks</Th>
                <Th align="right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {HORIZONS.map((horizonKey) => (
                <tr key={horizonKey}>
                  <Td className="font-mono text-xs">{horizonKey}</Td>
                  <Td align="right" className="tnum">
                    {consensus.byHorizon[horizonKey]}
                  </Td>
                  <Td align="right">
                    <Meter
                      value={consensus.byHorizon[horizonKey] / Math.max(1, consensus.predictionCount)}
                      className="ml-auto w-24"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Every prediction on this ticker"
          description={`${filtered.length} predictions across the whole course.`}
          action={
            <FilterPills
              options={[
                { value: "OVERALL", label: "All" },
                ...HORIZONS.map((value) => ({ value, label: value })),
              ]}
              active={horizon}
              paramName="horizon"
              searchParams={raw}
              basePath={`/stocks/${stock.ticker}`}
              size="sm"
            />
          }
        />
        <PredictionsTable
          predictions={filtered.slice(0, 60)}
          show="student"
          students={students}
          emptyTitle="No predictions on this ticker yet"
        />
      </Panel>
    </div>
  );
}

function MetricGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{title}</p>
      <dl className="mt-2.5 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="tnum font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
