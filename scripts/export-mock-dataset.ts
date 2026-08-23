import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mockDataset } from "@/lib/mock/dataset";
import { BASELINE_WEIGHTS } from "@/lib/mock/features";

/**
 * Writes the teaching dataset to /data/mock.
 *
 * These are the files students load into Spark in RA1 and into Postgres in RA2,
 * so the shape matters as much as the numbers: one row per entity per date, flat
 * columns, no nesting, and a header that matches the names used in the project
 * briefs. CSV for the pipelines, JSON for anyone poking at it by hand.
 */

const OUT_DIR = resolve(process.cwd(), "data/mock");

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0] as Record<string, unknown>);

  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(6);
    if (typeof value === "boolean") return value ? "true" : "false";
    const text = Array.isArray(value) ? value.join("|") : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => cell(row[column])).join(",")),
  ].join("\n");
}

function write(name: string, rows: Array<Record<string, unknown>>) {
  writeFileSync(`${OUT_DIR}/${name}.csv`, `${toCsv(rows)}\n`, "utf8");
  writeFileSync(`${OUT_DIR}/${name}.json`, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`  ${name.padEnd(20)} ${String(rows.length).padStart(7)} rows`);
}

const dataset = mockDataset();
mkdirSync(OUT_DIR, { recursive: true });

console.log(`Exporting mock dataset (seed "${dataset.seed}", anchor ${dataset.anchorDate})\n`);

write(
  "companies",
  dataset.stocks.map((stock) => ({
    ticker: stock.ticker,
    company_name: stock.companyName,
    sector: stock.sector,
    industry: stock.industry,
    country: stock.country,
    market_cap: stock.marketCap,
    employees: stock.employees,
    peer_group: stock.peerGroup,
  })),
);

write(
  "market_data",
  dataset.prices.map((price) => ({
    ticker: price.ticker,
    date: price.date,
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
    adjusted_close: price.adjustedClose,
    volume: Math.round(price.volume),
  })),
);

write(
  "benchmark",
  dataset.benchmark.map((row) => ({ date: row.date, close: row.close })),
);

write(
  "fundamentals",
  dataset.features.map((row) => ({
    ticker: row.ticker,
    snapshot_date: row.snapshotDate,
    pe_ratio: row.peRatio,
    forward_pe: row.forwardPe,
    peg_ratio: row.pegRatio,
    price_to_sales: row.priceToSales,
    price_to_book: row.priceToBook,
    ev_ebitda: row.evEbitda,
    ev_sales: row.evSales,
    fcf_yield: row.fcfYield,
    earnings_yield: row.earningsYield,
    revenue: row.revenue,
    revenue_growth_yoy: row.revenueGrowthYoy,
    ebitda: row.ebitda,
    ebitda_growth_yoy: row.ebitdaGrowthYoy,
    eps: row.eps,
    eps_growth_yoy: row.epsGrowthYoy,
    fcf: row.fcf,
    fcf_growth_yoy: row.fcfGrowthYoy,
    gross_margin: row.grossMargin,
    operating_margin: row.operatingMargin,
    net_margin: row.netMargin,
    roe: row.roe,
    roa: row.roa,
    roic: row.roic,
    cash: row.cash,
    total_debt: row.totalDebt,
    net_debt: row.netDebt,
    debt_to_equity: row.debtToEquity,
    net_debt_ebitda: row.netDebtEbitda,
    current_ratio: row.currentRatio,
    quick_ratio: row.quickRatio,
    interest_coverage: row.interestCoverage,
  })),
);

write(
  "earnings",
  dataset.features.map((row) => ({
    ticker: row.ticker,
    snapshot_date: row.snapshotDate,
    earnings_date: row.earningsDate,
    eps_estimate: row.epsEstimate,
    eps_actual: row.epsActual,
    eps_surprise_pct: row.epsSurprisePct,
    revenue_estimate: row.revenueEstimate,
    revenue_actual: row.revenueActual,
    revenue_surprise_pct: row.revenueSurprisePct,
    guidance_direction: row.guidanceDirection,
    earnings_sentiment: row.earningsSentiment,
    management_confidence: row.managementConfidence,
  })),
);

write(
  "competitors",
  dataset.features.map((row) => ({
    ticker: row.ticker,
    snapshot_date: row.snapshotDate,
    pe_vs_peers: row.peVsPeers,
    ev_ebitda_vs_peers: row.evEbitdaVsPeers,
    growth_vs_peers: row.growthVsPeers,
    margin_vs_peers: row.marginVsPeers,
    roic_vs_peers: row.roicVsPeers,
    sector_relative_pe: row.sectorRelativePe,
    sector_relative_growth: row.sectorRelativeGrowth,
    sector_relative_roic: row.sectorRelativeRoic,
  })),
);

write(
  "macro",
  dataset.features.map((row) => ({
    snapshot_date: row.snapshotDate,
    ticker: row.ticker,
    sp500_return_1m: row.sp500Return1m,
    nasdaq_return_1m: row.nasdaqReturn1m,
    sector_return_1m: row.sectorReturn1m,
    interest_rate: row.interestRate,
    inflation: row.inflation,
    market_regime: row.marketRegime,
  })),
);

write(
  "news_signals",
  dataset.features.map((row) => ({
    ticker: row.ticker,
    snapshot_date: row.snapshotDate,
    news_sentiment_7d: row.newsSentiment7d,
    news_sentiment_30d: row.newsSentiment30d,
    positive_news_count: row.positiveNewsCount,
    negative_news_count: row.negativeNewsCount,
    analyst_upgrades_30d: row.analystUpgrades30d,
    analyst_downgrades_30d: row.analystDowngrades30d,
    analyst_rating: row.analystRating,
    target_price_consensus: row.targetPriceConsensus,
    target_upside: row.targetUpside,
    number_of_analysts: row.numberOfAnalysts,
  })),
);

// The full point-in-time feature table — the single most important file for
// RA2, because it is the shape their own STOCK_FEATURES table should have.
write(
  "stock_features",
  dataset.features.map((row) => ({
    ticker: row.ticker,
    snapshot_date: row.snapshotDate,
    close: row.close,
    return_1d: row.return1d,
    return_1w: row.return1w,
    return_1m: row.return1m,
    momentum_1w: row.momentum1w,
    momentum_1m: row.momentum1m,
    momentum_3m: row.momentum3m,
    momentum_6m: row.momentum6m,
    volatility_30d: row.volatility30d,
    volatility_90d: row.volatility90d,
    drawdown: row.drawdown,
    distance_52w_high: row.distance52wHigh,
    distance_52w_low: row.distance52wLow,
    volume_change: row.volumeChange,
    pe_ratio: row.peRatio,
    forward_pe: row.forwardPe,
    ev_ebitda: row.evEbitda,
    price_to_sales: row.priceToSales,
    fcf_yield: row.fcfYield,
    revenue_growth_yoy: row.revenueGrowthYoy,
    eps_growth_yoy: row.epsGrowthYoy,
    ebitda_growth_yoy: row.ebitdaGrowthYoy,
    gross_margin: row.grossMargin,
    operating_margin: row.operatingMargin,
    net_margin: row.netMargin,
    roe: row.roe,
    roa: row.roa,
    roic: row.roic,
    debt_to_equity: row.debtToEquity,
    net_debt_ebitda: row.netDebtEbitda,
    current_ratio: row.currentRatio,
    earnings_surprise: row.epsSurprisePct,
    earnings_sentiment: row.earningsSentiment,
    sector_relative_pe: row.sectorRelativePe,
    sector_relative_growth: row.sectorRelativeGrowth,
    sector_relative_roic: row.sectorRelativeRoic,
    analyst_signal: row.analystRating,
    news_sentiment: row.newsSentiment30d,
    sp500_return_1m: row.sp500Return1m,
    nasdaq_return_1m: row.nasdaqReturn1m,
    sector_return_1m: row.sectorReturn1m,
    interest_rate: row.interestRate,
    inflation: row.inflation,
    market_regime: row.marketRegime,
    valuation_score: row.valuationScore,
    growth_score: row.growthScore,
    quality_score: row.qualityScore,
    financial_health_score: row.financialHealthScore,
    momentum_score: row.momentumScore,
    earnings_score: row.earningsScore,
    baseline_investment_score: row.baselineInvestmentScore,
  })),
);

write(
  "students",
  dataset.students.map((student) => ({
    student_id: student.id,
    name: student.name,
    handle: student.handle,
    joined_at: student.joinedAt,
  })),
);

write(
  "model_versions",
  dataset.modelVersions.map((version) => ({
    model_version_id: version.id,
    student_id: version.studentId,
    version: version.version,
    name: version.name,
    research_area: version.researchArea,
    approach: version.approach,
    created_at: version.createdAt,
  })),
);

write(
  "cycles",
  dataset.cycles.map((cycle) => ({
    cycle_id: cycle.id,
    label: cycle.label,
    year: cycle.year,
    week_number: cycle.weekNumber,
    opens_at: cycle.opensAt,
    deadline_at: cycle.deadlineAt,
    locked_at: cycle.lockedAt,
    status: cycle.status,
  })),
);

// Predictions joined with their outcome: this is the file that teaches what a
// labelled training row looks like once the horizon has elapsed.
const resultsById = new Map(dataset.results.map((result) => [result.predictionId, result]));
write(
  "predictions",
  dataset.predictions.map((prediction) => {
    const result = resultsById.get(prediction.id);
    return {
      prediction_id: prediction.id,
      student_id: prediction.studentId,
      cycle_id: prediction.cycleId,
      model_version_id: prediction.modelVersionId,
      ticker: prediction.ticker,
      horizon: prediction.horizon,
      rank: prediction.rank,
      probability: prediction.probability,
      expected_return: prediction.expectedReturn,
      target_price: prediction.targetPrice,
      prediction_date: prediction.predictionDate,
      resolution_date: prediction.resolutionDate,
      status: prediction.status,
      prediction_price: result?.predictionPrice ?? null,
      resolution_price: result?.resolutionPrice ?? null,
      realized_return: result?.realizedReturn ?? null,
      benchmark_return: result?.benchmarkReturn ?? null,
      alpha: result?.alpha ?? null,
      hit_target: result ? result.hitTarget : null,
      resolved_at: result?.resolvedAt ?? null,
    };
  }),
);

writeFileSync(
  `${OUT_DIR}/README.md`,
  `# Mock dataset

Generated by \`npm run data:export\`. Deterministic: same seed, same files.

| Field | Value |
| --- | --- |
| Seed | \`${dataset.seed}\` |
| Anchor date | ${dataset.anchorDate} |
| Cycles | ${dataset.cycles.length} |
| Students | ${dataset.students.length} |
| Stocks | ${dataset.stocks.length} |
| Predictions | ${dataset.predictions.length} (${dataset.results.length} resolved) |

Every file exists as both \`.csv\` and \`.json\`.

| File | Grain | Use |
| --- | --- | --- |
| \`companies\` | one row per ticker | \`DIM_COMPANY\` |
| \`market_data\` | ticker × trading day | \`FACT_MARKET_DATA\` |
| \`benchmark\` | trading day | equal-weight universe index |
| \`fundamentals\` | ticker × snapshot date | \`FACT_FINANCIALS\` |
| \`earnings\` | ticker × snapshot date | \`FACT_EARNINGS\` |
| \`competitors\` | ticker × snapshot date | \`FACT_COMPETITOR_METRICS\` |
| \`news_signals\` | ticker × snapshot date | \`FACT_NEWS_SIGNALS\` |
| \`macro\` | ticker × snapshot date | market regime and index returns |
| \`stock_features\` | ticker × snapshot date | \`STOCK_FEATURES\` — the RA2 target shape |
| \`students\` | one row per student | \`DIM_STUDENT\` |
| \`model_versions\` | student × model | model lineage |
| \`cycles\` | one row per week | \`DIM_DATE\` at cycle grain |
| \`predictions\` | one row per prediction | \`FACT_PREDICTIONS\`, joined with its outcome |

## Point-in-time correctness

Every row in \`stock_features\` is dated. A row's \`snapshot_date\` is the last day
whose information it contains — nothing in that row was published afterwards.
When you build a training set, join labels by \`prediction_date\` and never by
row order, or you will leak the future into your features and score far better in
backtest than you ever will on the leaderboard.

## Reference baseline

\`baseline_investment_score\` is a weighted blend of the six component scores:

${Object.entries(BASELINE_WEIGHTS)
  .map(([key, weight]) => `- \`${key}\` × ${weight}`)
  .join("\n")}

These weights are an example, not an answer. RA1 asks you to choose your own and
justify them.
`,
  "utf8",
);

console.log(`\nWrote ${OUT_DIR}`);
