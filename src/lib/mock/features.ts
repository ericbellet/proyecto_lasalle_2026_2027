import { addDays, parseIsoDate, toIsoDate } from "@/lib/dates";
import { Rng, round } from "@/lib/mock/random";
import { trailingStats, type PriceSeries } from "@/lib/mock/series";
import { STOCK_UNIVERSE, type StockProfile } from "@/lib/mock/universe";
import type { StockFeatureRow } from "@/lib/types";

/**
 * The teaching feature table.
 *
 * One row is "everything knowable about a ticker on a given Monday". Market
 * numbers come from the simulated price history; fundamentals evolve along a
 * slow random walk anchored to each company's real-world profile.
 *
 * The derived scores are cross-sectional percentile ranks, which is what makes
 * the dataset internally consistent: a company cannot have the best revenue
 * growth in the universe and a bottom-quartile growth score.
 */

/** Weights of the reference baseline score handed to students in RA1. */
export const BASELINE_WEIGHTS = {
  valuation: 0.2,
  growth: 0.2,
  quality: 0.2,
  financialHealth: 0.15,
  momentum: 0.15,
  earnings: 0.1,
} as const;

interface DriftedFundamentals {
  revenueGrowth: number;
  ebitdaGrowth: number;
  epsGrowth: number;
  fcfGrowth: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  roic: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  interestCoverage: number;
  epsSurprisePct: number;
  revenueSurprisePct: number;
  guidanceDirection: "up" | "flat" | "down";
  earningsSentiment: number;
  managementConfidence: number;
  newsSentiment7d: number;
  newsSentiment30d: number;
  positiveNewsCount: number;
  negativeNewsCount: number;
  analystUpgrades30d: number;
  analystDowngrades30d: number;
  analystRating: number;
  numberOfAnalysts: number;
}

function driftFundamentals(
  profile: StockProfile,
  cycleIndex: number,
  seed: string,
): DriftedFundamentals {
  const rng = new Rng(`${seed}:${profile.ticker}:fund:${cycleIndex}`);
  // A slow cycle so consecutive weeks look related rather than independent.
  const wave = Math.sin((cycleIndex / 9) + profile.ticker.length);
  const nudge = (base: number, amplitude: number) =>
    base * (1 + wave * amplitude * 0.35) + rng.normal(0, Math.abs(base) * amplitude * 0.12);

  const f = profile.fundamentals;
  const surprise = rng.normal(0.02, 0.055);

  return {
    revenueGrowth: round(nudge(f.revenueGrowth, 0.22), 4),
    ebitdaGrowth: round(nudge(f.revenueGrowth * 1.18, 0.3), 4),
    epsGrowth: round(nudge(f.revenueGrowth * 1.35, 0.4), 4),
    fcfGrowth: round(nudge(f.revenueGrowth * 1.1, 0.45), 4),
    grossMargin: round(nudge(f.grossMargin, 0.05), 4),
    operatingMargin: round(nudge(f.operatingMargin, 0.08), 4),
    netMargin: round(nudge(f.netMargin, 0.09), 4),
    roe: round(nudge(f.roe, 0.1), 4),
    roa: round(nudge(f.roa, 0.1), 4),
    roic: round(nudge(f.roic, 0.09), 4),
    debtToEquity: round(Math.max(nudge(f.debtToEquity, 0.12), 0.01), 4),
    currentRatio: round(Math.max(nudge(f.currentRatio, 0.1), 0.2), 3),
    quickRatio: round(Math.max(nudge(f.currentRatio * 0.82, 0.11), 0.15), 3),
    interestCoverage: round(Math.max(nudge(12 / Math.max(f.debtToEquity, 0.05), 0.25), 0.5), 2),
    epsSurprisePct: round(surprise, 4),
    revenueSurprisePct: round(surprise * 0.45 + rng.normal(0, 0.012), 4),
    guidanceDirection: surprise > 0.045 ? "up" : surprise < -0.02 ? "down" : "flat",
    earningsSentiment: round(clamp01(0.5 + surprise * 4 + rng.normal(0, 0.08)), 3),
    managementConfidence: round(clamp01(0.5 + surprise * 3 + rng.normal(0, 0.1)), 3),
    newsSentiment7d: round(clamp(rng.normal(surprise * 3, 0.32), -1, 1), 3),
    newsSentiment30d: round(clamp(rng.normal(surprise * 2.2, 0.24), -1, 1), 3),
    positiveNewsCount: Math.max(0, Math.round(rng.normal(14 + surprise * 60, 5))),
    negativeNewsCount: Math.max(0, Math.round(rng.normal(9 - surprise * 40, 4))),
    analystUpgrades30d: Math.max(0, Math.round(rng.normal(2 + surprise * 25, 1.4))),
    analystDowngrades30d: Math.max(0, Math.round(rng.normal(2 - surprise * 20, 1.2))),
    analystRating: round(clamp(rng.normal(3.9 + surprise * 6, 0.35), 1, 5), 2),
    numberOfAnalysts: Math.round(rng.float(24, 58)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Percentile position of each value inside the array, in [0, 1]. */
function percentileRanks(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length).fill(0);
  const denominator = Math.max(values.length - 1, 1);
  order.forEach((entry, position) => {
    ranks[entry.index] = position / denominator;
  });
  return ranks;
}

function blend(parts: Array<{ ranks: number[]; weight: number; invert?: boolean }>, index: number) {
  const totalWeight = parts.reduce((acc, part) => acc + part.weight, 0);
  const total = parts.reduce((acc, part) => {
    const rank = part.ranks[index] ?? 0.5;
    return acc + part.weight * (part.invert ? 1 - rank : rank);
  }, 0);
  return total / totalWeight;
}

const EARNINGS_EPOCH = "2025-01-15";

/** Most recent quarterly reporting date on or before `date`. */
function lastEarningsDate(ticker: string, date: string): string {
  const tickerOffset = (ticker.charCodeAt(0) * 7) % 91;
  const firstReport = addDays(parseIsoDate(EARNINGS_EPOCH), tickerOffset);
  const elapsedDays = Math.floor(
    (parseIsoDate(date).getTime() - firstReport.getTime()) / 86_400_000,
  );
  const quarters = Math.max(Math.floor(elapsedDays / 91), 0);
  return toIsoDate(addDays(firstReport, quarters * 91));
}

export function buildFeatureRows(
  series: PriceSeries,
  cycleDates: string[],
  seed: string,
): StockFeatureRow[] {
  const rows: StockFeatureRow[] = [];

  cycleDates.forEach((date, cycleIndex) => {
    const macroRng = new Rng(`${seed}:macro:${cycleIndex}`);
    const interestRate = round(clamp(3.75 + Math.sin(cycleIndex / 11) * 0.6 + macroRng.normal(0, 0.05), 1, 8), 2);
    const inflation = round(clamp(2.6 + Math.sin(cycleIndex / 8 + 1) * 0.5 + macroRng.normal(0, 0.06), 0, 9), 2);

    const drafts = STOCK_UNIVERSE.map((profile) => {
      const stats = trailingStats(series, profile.ticker, date);
      const fundamentals = driftFundamentals(profile, cycleIndex, seed);
      const rng = new Rng(`${seed}:${profile.ticker}:row:${cycleIndex}`);
      return { profile, stats, fundamentals, rng };
    });

    const usable = drafts.filter((draft) => draft.stats !== null);
    if (usable.length !== drafts.length) return;

    // Cross-sectional inputs for the derived scores.
    const fcfYield = usable.map(
      (d) => (d.profile.fundamentals.fcfMargin * d.profile.fundamentals.revenue) / d.profile.marketCap,
    );
    const earningsYield = usable.map((d) => 1 / d.profile.fundamentals.peRatio);
    const evEbitda = usable.map((d) => d.profile.fundamentals.evEbitda);
    const priceToSales = usable.map((d) => d.profile.fundamentals.priceToSales);

    const revenueGrowth = usable.map((d) => d.fundamentals.revenueGrowth);
    const epsGrowth = usable.map((d) => d.fundamentals.epsGrowth);
    const ebitdaGrowth = usable.map((d) => d.fundamentals.ebitdaGrowth);
    const fcfGrowth = usable.map((d) => d.fundamentals.fcfGrowth);

    const roic = usable.map((d) => d.fundamentals.roic);
    const roe = usable.map((d) => d.fundamentals.roe);
    const grossMargin = usable.map((d) => d.fundamentals.grossMargin);
    const operatingMargin = usable.map((d) => d.fundamentals.operatingMargin);

    const debtToEquity = usable.map((d) => d.fundamentals.debtToEquity);
    const currentRatio = usable.map((d) => d.fundamentals.currentRatio);
    const interestCoverage = usable.map((d) => d.fundamentals.interestCoverage);

    const momentum1m = usable.map((d) => d.stats?.return1m ?? 0);
    const momentum3m = usable.map((d) => d.stats?.return3m ?? 0);
    const momentum6m = usable.map((d) => d.stats?.return6m ?? 0);
    const volatility30d = usable.map((d) => d.stats?.volatility30d ?? 0);

    const epsSurprise = usable.map((d) => d.fundamentals.epsSurprisePct);
    const revenueSurprise = usable.map((d) => d.fundamentals.revenueSurprisePct);
    const earningsSentiment = usable.map((d) => d.fundamentals.earningsSentiment);

    const ranks = {
      fcfYield: percentileRanks(fcfYield),
      earningsYield: percentileRanks(earningsYield),
      evEbitda: percentileRanks(evEbitda),
      priceToSales: percentileRanks(priceToSales),
      revenueGrowth: percentileRanks(revenueGrowth),
      epsGrowth: percentileRanks(epsGrowth),
      ebitdaGrowth: percentileRanks(ebitdaGrowth),
      fcfGrowth: percentileRanks(fcfGrowth),
      roic: percentileRanks(roic),
      roe: percentileRanks(roe),
      grossMargin: percentileRanks(grossMargin),
      operatingMargin: percentileRanks(operatingMargin),
      debtToEquity: percentileRanks(debtToEquity),
      currentRatio: percentileRanks(currentRatio),
      interestCoverage: percentileRanks(interestCoverage),
      momentum1m: percentileRanks(momentum1m),
      momentum3m: percentileRanks(momentum3m),
      momentum6m: percentileRanks(momentum6m),
      volatility30d: percentileRanks(volatility30d),
      epsSurprise: percentileRanks(epsSurprise),
      revenueSurprise: percentileRanks(revenueSurprise),
      earningsSentiment: percentileRanks(earningsSentiment),
    };

    // Sector aggregates, used for the "relative to sector" columns.
    const sectorAverages = new Map<string, { pe: number[]; growth: number[]; roic: number[] }>();
    usable.forEach((draft) => {
      const bucket = sectorAverages.get(draft.profile.sector) ?? { pe: [], growth: [], roic: [] };
      bucket.pe.push(draft.profile.fundamentals.peRatio);
      bucket.growth.push(draft.fundamentals.revenueGrowth);
      bucket.roic.push(draft.fundamentals.roic);
      sectorAverages.set(draft.profile.sector, bucket);
    });
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

    usable.forEach((draft, index) => {
      const { profile, fundamentals, rng } = draft;
      const stats = draft.stats as NonNullable<typeof draft.stats>;
      const f = profile.fundamentals;

      const valuationScore = blend(
        [
          { ranks: ranks.fcfYield, weight: 0.3 },
          { ranks: ranks.earningsYield, weight: 0.3 },
          { ranks: ranks.evEbitda, weight: 0.2, invert: true },
          { ranks: ranks.priceToSales, weight: 0.2, invert: true },
        ],
        index,
      );

      const growthScore = blend(
        [
          { ranks: ranks.revenueGrowth, weight: 0.35 },
          { ranks: ranks.epsGrowth, weight: 0.3 },
          { ranks: ranks.ebitdaGrowth, weight: 0.2 },
          { ranks: ranks.fcfGrowth, weight: 0.15 },
        ],
        index,
      );

      const qualityScore = blend(
        [
          { ranks: ranks.roic, weight: 0.35 },
          { ranks: ranks.roe, weight: 0.25 },
          { ranks: ranks.grossMargin, weight: 0.2 },
          { ranks: ranks.operatingMargin, weight: 0.2 },
        ],
        index,
      );

      const financialHealthScore = blend(
        [
          { ranks: ranks.debtToEquity, weight: 0.35, invert: true },
          { ranks: ranks.currentRatio, weight: 0.3 },
          { ranks: ranks.interestCoverage, weight: 0.35 },
        ],
        index,
      );

      const momentumScore = blend(
        [
          { ranks: ranks.momentum1m, weight: 0.25 },
          { ranks: ranks.momentum3m, weight: 0.35 },
          { ranks: ranks.momentum6m, weight: 0.25 },
          { ranks: ranks.volatility30d, weight: 0.15, invert: true },
        ],
        index,
      );

      const earningsScore = blend(
        [
          { ranks: ranks.epsSurprise, weight: 0.4 },
          { ranks: ranks.revenueSurprise, weight: 0.25 },
          { ranks: ranks.earningsSentiment, weight: 0.35 },
        ],
        index,
      );

      const baselineInvestmentScore =
        BASELINE_WEIGHTS.valuation * valuationScore +
        BASELINE_WEIGHTS.growth * growthScore +
        BASELINE_WEIGHTS.quality * qualityScore +
        BASELINE_WEIGHTS.financialHealth * financialHealthScore +
        BASELINE_WEIGHTS.momentum * momentumScore +
        BASELINE_WEIGHTS.earnings * earningsScore;

      const sector = sectorAverages.get(profile.sector);
      const revenue = f.revenue * (1 + fundamentals.revenueGrowth * (cycleIndex / 52));
      const ebitda = revenue * f.ebitdaMargin;
      const fcf = revenue * f.fcfMargin;
      const netDebt = f.debtToEquity * profile.marketCap * 0.09;
      const targetUpside = clamp(rng.normal(0.12, 0.09), -0.25, 0.6);

      rows.push({
        ticker: profile.ticker,
        snapshotDate: date,

        close: round(stats.close, 2),
        return1d: round(stats.return1d, 5),
        return1w: round(stats.return1w, 5),
        return1m: round(stats.return1m, 5),
        momentum1w: round(stats.return1w, 5),
        momentum1m: round(stats.return1m, 5),
        momentum3m: round(stats.return3m, 5),
        momentum6m: round(stats.return6m, 5),
        volatility30d: round(stats.volatility30d, 5),
        volatility90d: round(stats.volatility90d, 5),
        drawdown: round(stats.drawdown, 5),
        distance52wHigh: round(stats.distance52wHigh, 5),
        distance52wLow: round(stats.distance52wLow, 5),
        volumeChange: round(rng.normal(0, 0.18), 4),

        peRatio: round(f.peRatio * (1 + rng.normal(0, 0.04)), 2),
        forwardPe: round(f.forwardPe * (1 + rng.normal(0, 0.04)), 2),
        pegRatio: round(f.forwardPe / Math.max(fundamentals.epsGrowth * 100, 1), 2),
        priceToSales: round(f.priceToSales * (1 + rng.normal(0, 0.04)), 2),
        priceToBook: round(f.priceToBook * (1 + rng.normal(0, 0.05)), 2),
        evEbitda: round(f.evEbitda * (1 + rng.normal(0, 0.05)), 2),
        evSales: round(f.priceToSales * 1.06 * (1 + rng.normal(0, 0.05)), 2),
        fcfYield: round((fcf / profile.marketCap) * (1 + rng.normal(0, 0.05)), 5),
        earningsYield: round(1 / f.peRatio, 5),

        revenue: Math.round(revenue),
        revenueGrowthYoy: fundamentals.revenueGrowth,
        ebitda: Math.round(ebitda),
        ebitdaGrowthYoy: fundamentals.ebitdaGrowth,
        eps: round(f.eps * (1 + fundamentals.epsGrowth * (cycleIndex / 52)), 3),
        epsGrowthYoy: fundamentals.epsGrowth,
        fcf: Math.round(fcf),
        fcfGrowthYoy: fundamentals.fcfGrowth,

        grossMargin: fundamentals.grossMargin,
        operatingMargin: fundamentals.operatingMargin,
        netMargin: fundamentals.netMargin,
        roe: fundamentals.roe,
        roa: fundamentals.roa,
        roic: fundamentals.roic,

        cash: Math.round(revenue * 0.18),
        totalDebt: Math.round(netDebt + revenue * 0.18),
        netDebt: Math.round(netDebt),
        debtToEquity: fundamentals.debtToEquity,
        netDebtEbitda: round(netDebt / Math.max(ebitda, 1), 3),
        currentRatio: fundamentals.currentRatio,
        quickRatio: fundamentals.quickRatio,
        interestCoverage: fundamentals.interestCoverage,

        earningsDate: lastEarningsDate(profile.ticker, date),
        epsEstimate: round(f.eps * (1 + rng.normal(0, 0.02)), 3),
        epsActual: round(f.eps * (1 + fundamentals.epsSurprisePct), 3),
        epsSurprisePct: fundamentals.epsSurprisePct,
        revenueEstimate: Math.round(revenue / 4),
        revenueActual: Math.round((revenue / 4) * (1 + fundamentals.revenueSurprisePct)),
        revenueSurprisePct: fundamentals.revenueSurprisePct,
        guidanceDirection: fundamentals.guidanceDirection,
        earningsSentiment: fundamentals.earningsSentiment,
        managementConfidence: fundamentals.managementConfidence,

        peVsPeers: round(f.peRatio / avg(peerValues(profile, usable, (d) => d.profile.fundamentals.peRatio)), 3),
        evEbitdaVsPeers: round(
          f.evEbitda / avg(peerValues(profile, usable, (d) => d.profile.fundamentals.evEbitda)),
          3,
        ),
        growthVsPeers: round(
          fundamentals.revenueGrowth -
            avg(peerValues(profile, usable, (d) => d.fundamentals.revenueGrowth)),
          4,
        ),
        marginVsPeers: round(
          fundamentals.operatingMargin -
            avg(peerValues(profile, usable, (d) => d.fundamentals.operatingMargin)),
          4,
        ),
        roicVsPeers: round(
          fundamentals.roic - avg(peerValues(profile, usable, (d) => d.fundamentals.roic)),
          4,
        ),
        sectorRelativePe: round(f.peRatio / Math.max(avg(sector?.pe ?? [f.peRatio]), 0.01), 3),
        sectorRelativeGrowth: round(
          fundamentals.revenueGrowth - avg(sector?.growth ?? [fundamentals.revenueGrowth]),
          4,
        ),
        sectorRelativeRoic: round(fundamentals.roic - avg(sector?.roic ?? [fundamentals.roic]), 4),

        newsSentiment7d: fundamentals.newsSentiment7d,
        newsSentiment30d: fundamentals.newsSentiment30d,
        positiveNewsCount: fundamentals.positiveNewsCount,
        negativeNewsCount: fundamentals.negativeNewsCount,
        analystUpgrades30d: fundamentals.analystUpgrades30d,
        analystDowngrades30d: fundamentals.analystDowngrades30d,

        analystRating: fundamentals.analystRating,
        targetPriceConsensus: round(stats.close * (1 + targetUpside), 2),
        targetUpside: round(targetUpside, 4),
        numberOfAnalysts: fundamentals.numberOfAnalysts,

        sp500Return1m: round(rng.normal(0.009, 0.032), 4),
        nasdaqReturn1m: round(rng.normal(0.013, 0.041), 4),
        sectorReturn1m: round(rng.normal(0.011, 0.038), 4),
        interestRate,
        inflation,
        marketRegime: stats.volatility30d > 0.36 ? "risk-off" : stats.volatility30d < 0.2 ? "risk-on" : "neutral",

        valuationScore: round(valuationScore, 4),
        growthScore: round(growthScore, 4),
        qualityScore: round(qualityScore, 4),
        financialHealthScore: round(financialHealthScore, 4),
        momentumScore: round(momentumScore, 4),
        earningsScore: round(earningsScore, 4),
        baselineInvestmentScore: round(baselineInvestmentScore, 4),
      });
    });
  });

  return rows;
}

function peerValues<T extends { profile: StockProfile }>(
  profile: StockProfile,
  drafts: T[],
  read: (draft: T) => number,
): number[] {
  const values = drafts.filter((draft) => profile.peerGroup.includes(draft.profile.ticker)).map(read);
  return values.length ? values : [read(drafts.find((d) => d.profile.ticker === profile.ticker) as T)];
}
