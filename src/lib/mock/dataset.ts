import {
  HORIZONS,
  HORIZON_CALENDAR_DAYS,
  PICKS_PER_HORIZON,
  RESEARCH_AREAS,
  TARGET_RETURN,
  type Horizon,
  type ResearchArea,
} from "@/config/challenge";
import {
  addDays,
  calculateResolutionDate,
  cycleIdFor,
  nearestMarketDay,
  parseIsoDate,
  startOfIsoWeek,
  toIsoDate,
} from "@/lib/dates";
import { buildFeatureRows } from "@/lib/mock/features";
import { Rng, round } from "@/lib/mock/random";
import {
  baseRateProbability,
  benchmarkOnOrBefore,
  buildPriceSeries,
  closeOnOrBefore,
  returnOver,
  type PriceSeries,
} from "@/lib/mock/series";
import { STUDENT_PROFILES, type StudentProfile } from "@/lib/mock/students";
import { STOCK_UNIVERSE, stockProfile, toStock } from "@/lib/mock/universe";
import type {
  IntegrationStatus,
  MarketPrice,
  ModelVersion,
  Prediction,
  PredictionCycle,
  PredictionResult,
  PredictionSnapshot,
  Stock,
  StockFeatureRow,
  Student,
  StudentIntegration,
} from "@/lib/types";

/**
 * Assembles the whole synthetic world in one deterministic pass.
 *
 * The result is the source of truth for MOCK_MODE, for the CSV exports handed
 * to students, and for the database seed. Because it is pure and seeded, the
 * three always agree.
 */

export const MOCK_SEED = process.env.MOCK_SEED ?? "value-investing-challenge-2026";

/**
 * The Monday of the most recent cycle. Pinned rather than derived from the
 * clock so screenshots, tests and seeded databases stay reproducible.
 */
export const ANCHOR_DATE = process.env.MOCK_ANCHOR_DATE ?? "2026-08-24";

/**
 * Weekly cycles generated, spanning an academic year split into three RAs.
 *
 * Forty is the smallest number that leaves a usable sample of *resolved* 6-month
 * predictions: a shorter season resolves plenty of 1W calls and almost no 6M
 * ones, which makes the long-horizon leaderboard meaningless.
 */
export const CYCLE_COUNT = Number(process.env.MOCK_CYCLES ?? 40);

/** Extra price history before the first cycle, so 52-week metrics are defined. */
const HISTORY_LEAD_DAYS = 400;

export interface MockDataset {
  seed: string;
  anchorDate: string;
  generatedAt: string;
  stocks: Stock[];
  prices: MarketPrice[];
  benchmark: Array<{ date: string; close: number }>;
  features: StockFeatureRow[];
  students: Student[];
  integrations: StudentIntegration[];
  modelVersions: ModelVersion[];
  cycles: PredictionCycle[];
  snapshots: PredictionSnapshot[];
  predictions: Prediction[];
  results: PredictionResult[];
}

/** Which research area a cycle belongs to. RA1 → RA2 → RA3, evenly split. */
export function researchAreaForCycle(cycleIndex: number, total = CYCLE_COUNT): ResearchArea {
  const perArea = Math.ceil(total / RESEARCH_AREAS.length);
  const position = Math.min(Math.floor(cycleIndex / perArea), RESEARCH_AREAS.length - 1);
  return RESEARCH_AREAS[position] as ResearchArea;
}

function buildCycles(anchor: string, count: number): PredictionCycle[] {
  const anchorMonday = startOfIsoWeek(parseIsoDate(anchor));
  const cycles: PredictionCycle[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const monday = addDays(anchorMonday, -offset * 7);
    const id = cycleIdFor(monday);
    const isCurrent = offset === 0;
    cycles.push({
      id,
      label: id.replace("-W", " · Week "),
      weekNumber: Number(id.slice(-2)),
      year: Number(id.slice(0, 4)),
      opensAt: `${toIsoDate(addDays(monday, -3))}T09:00:00.000Z`,
      deadlineAt: `${toIsoDate(monday)}T08:00:00.000Z`,
      lockedAt: isCurrent ? null : `${toIsoDate(monday)}T08:05:00.000Z`,
      status: isCurrent ? "open" : "locked",
    });
  }

  return cycles;
}

function buildStudents(): Student[] {
  return STUDENT_PROFILES.map((profile, index) => ({
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    avatarSeed: profile.handle,
    joinedAt: `2026-01-1${(index % 5) + 2}T10:00:00.000Z`,
  }));
}

function buildModelVersions(cycles: PredictionCycle[]): ModelVersion[] {
  const versions: ModelVersion[] = [];
  const areaStart = new Map<ResearchArea, string>();
  const areaEnd = new Map<ResearchArea, string>();

  cycles.forEach((cycle, index) => {
    const area = researchAreaForCycle(index, cycles.length);
    if (!areaStart.has(area)) areaStart.set(area, cycle.deadlineAt);
    areaEnd.set(area, cycle.deadlineAt);
  });

  for (const profile of STUDENT_PROFILES) {
    for (const area of RESEARCH_AREAS) {
      const model = profile.models[area];
      const isLatest = area === RESEARCH_AREAS[RESEARCH_AREAS.length - 1];
      versions.push({
        id: `${profile.id}-${model.version}`,
        studentId: profile.id,
        version: model.version,
        name: model.name,
        researchArea: area,
        approach: model.approach,
        createdAt: areaStart.get(area) ?? `${ANCHOR_DATE}T08:00:00.000Z`,
        retiredAt: isLatest ? null : (areaEnd.get(area) ?? null),
      });
    }
  }

  return versions;
}

function buildIntegrations(rng: Rng, cycles: PredictionCycle[]): StudentIntegration[] {
  const lastCycle = cycles[cycles.length - 1] as PredictionCycle;

  return STUDENT_PROFILES.map((profile, index) => {
    // A couple of endpoints are deliberately unhealthy so the admin panel has
    // something real to show.
    const status: IntegrationStatus =
      index === 3 ? "error" : index === 9 ? "timeout" : index === 13 ? "invalid" : "healthy";

    const errors: Record<IntegrationStatus, string | null> = {
      healthy: null,
      error: "HTTP 502 from upstream deployment",
      timeout: "No response within 8000 ms",
      invalid: "predictions.4.probability: Number must be less than or equal to 1",
      unknown: null,
    };

    return {
      studentId: profile.id,
      baseUrl: `https://${profile.handle}-investing.vercel.app`,
      predictionsEndpoint: "/api/predictions",
      healthEndpoint: "/api/health",
      apiKeyEnvVar: index % 4 === 0 ? `STUDENT_${profile.id.replace("-", "_").toUpperCase()}_KEY` : null,
      enabled: true,
      lastFetchAt: `${toIsoDate(parseIsoDate(lastCycle.deadlineAt.slice(0, 10)))}T08:0${rng.int(1, 9)}:00.000Z`,
      lastStatus: status,
      lastError: errors[status],
      lastLatencyMs: status === "timeout" ? 8000 : rng.int(120, 1400),
    };
  });
}

/**
 * Not everybody submits every week. A few students miss cycles and one joins
 * late, which is what makes the sample-reliability guard and the "n =" column
 * on the leaderboard do real work.
 */
const PARTICIPATION: Record<string, { firstCycle?: number; missRate?: number }> = {
  "student-04": { missRate: 0.16 },
  "student-08": { missRate: 0.09 },
  "student-12": { missRate: 0.06 },
  "student-14": { firstCycle: 4, missRate: 0.12 },
};

function participates(studentId: string, cycleIndex: number, cycleId: string): boolean {
  const rule = PARTICIPATION[studentId];
  if (!rule) return true;
  if (rule.firstCycle !== undefined && cycleIndex < rule.firstCycle) return false;
  if (rule.missRate === undefined) return true;
  return new Rng(`${MOCK_SEED}:${studentId}:${cycleId}:participation`).next() >= rule.missRate;
}

interface PickCandidate {
  ticker: string;
  baselineScore: number;
  baseRate: number;
  forwardReturn: number | null;
  attractiveness: number;
}

function buildPredictions(
  series: PriceSeries,
  features: StockFeatureRow[],
  cycles: PredictionCycle[],
  modelVersions: ModelVersion[],
  anchor: string,
): {
  predictions: Prediction[];
  results: PredictionResult[];
  snapshots: PredictionSnapshot[];
} {
  const predictions: Prediction[] = [];
  const results: PredictionResult[] = [];
  const snapshots: PredictionSnapshot[] = [];

  const featureIndex = new Map<string, StockFeatureRow>();
  for (const row of features) featureIndex.set(`${row.ticker}:${row.snapshotDate}`, row);

  cycles.forEach((cycle, cycleIndex) => {
    const area = researchAreaForCycle(cycleIndex, cycles.length);
    const cycleDate = cycle.deadlineAt.slice(0, 10);
    const predictionDate = toIsoDate(nearestMarketDay(parseIsoDate(cycleDate), -1));

    // Forward outcomes are known to the generator only. They are what turns a
    // "skill" number into predictions that actually came true.
    const outcomes = new Map<Horizon, Map<string, number | null>>();
    for (const horizon of HORIZONS) {
      const resolutionDate = toIsoDate(calculateResolutionDate(predictionDate, horizon));
      const perTicker = new Map<string, number | null>();
      for (const profile of STOCK_UNIVERSE) {
        perTicker.set(
          profile.ticker,
          resolutionDate <= anchor ? returnOver(series, profile.ticker, predictionDate, resolutionDate) : null,
        );
      }
      outcomes.set(horizon, perTicker);
    }

    for (const profile of STUDENT_PROFILES) {
      if (!participates(profile.id, cycleIndex, cycle.id)) continue;

      const modelVersion = modelVersions.find(
        (version) => version.studentId === profile.id && version.researchArea === area,
      );
      if (!modelVersion) continue;

      const studentPredictions: Prediction[] = [];
      const previousPicks = new Set<string>();

      for (const horizon of HORIZONS) {
        const rng = new Rng(`${MOCK_SEED}:${profile.id}:${cycle.id}:${horizon}`);
        const horizonOutcomes = outcomes.get(horizon) as Map<string, number | null>;
        const candidates = rankCandidates(
          profile,
          area,
          horizon,
          cycleDate,
          featureIndex,
          horizonOutcomes,
          previousPicks,
          rng,
        );

        const chosen = candidates.slice(0, PICKS_PER_HORIZON);
        chosen.forEach((candidate, position) => {
          previousPicks.add(candidate.ticker);
          const rank = position + 1;
          const outcome = horizonOutcomes.get(candidate.ticker) ?? null;
          const probability = statedProbability(profile, area, candidate, outcome, rng);
          const expectedReturn = round(
            Math.min(Math.max(TARGET_RETURN + probability * 0.32 + rng.normal(0, 0.025), 0.02), 0.65),
            4,
          );
          const entryPrice = closeOnOrBefore(series, candidate.ticker, predictionDate) ?? 0;
          const resolutionDate = toIsoDate(calculateResolutionDate(predictionDate, horizon));
          const isResolved = resolutionDate <= anchor && outcome !== null;

          const prediction: Prediction = {
            id: `${profile.id}--${cycle.id}--${horizon}--${rank}`,
            snapshotId: `${profile.id}--${cycle.id}`,
            studentId: profile.id,
            cycleId: cycle.id,
            modelVersionId: modelVersion.id,
            ticker: candidate.ticker,
            horizon,
            rank,
            probability: round(probability, 4),
            expectedReturn,
            targetPrice: round(entryPrice * (1 + expectedReturn), 2),
            investmentThesis: thesisFor(candidate, horizon, area, rng),
            risks: risksFor(candidate, rng),
            predictionDate,
            resolutionDate,
            status: isResolved ? "resolved" : "active",
          };

          studentPredictions.push(prediction);
          predictions.push(prediction);

          if (isResolved) {
            const exitPrice = closeOnOrBefore(series, candidate.ticker, resolutionDate) ?? entryPrice;
            const benchmarkFrom = benchmarkOnOrBefore(series, predictionDate) ?? 1;
            const benchmarkTo = benchmarkOnOrBefore(series, resolutionDate) ?? benchmarkFrom;
            const realizedReturn = outcome as number;
            const benchmarkReturn = benchmarkTo / benchmarkFrom - 1;

            results.push({
              predictionId: prediction.id,
              predictionPrice: round(entryPrice, 2),
              resolutionPrice: round(exitPrice, 2),
              realizedReturn: round(realizedReturn, 5),
              benchmarkReturn: round(benchmarkReturn, 5),
              alpha: round(realizedReturn - benchmarkReturn, 5),
              hitTarget: realizedReturn >= TARGET_RETURN,
              resolvedAt: `${resolutionDate}T22:00:00.000Z`,
            });
          }
        });
      }

      const payload = {
        student_id: profile.id,
        model_version: modelVersion.version,
        model_name: modelVersion.name,
        generated_at: cycle.deadlineAt,
        predictions: studentPredictions.map((prediction) => ({
          ticker: prediction.ticker,
          horizon: prediction.horizon,
          rank: prediction.rank,
          probability: prediction.probability,
          expected_return: prediction.expectedReturn,
          target_price: prediction.targetPrice,
          investment_thesis: prediction.investmentThesis,
          risks: prediction.risks,
        })),
      };

      snapshots.push({
        id: `${profile.id}--${cycle.id}`,
        studentId: profile.id,
        cycleId: cycle.id,
        modelVersionId: modelVersion.id,
        rawPayload: payload,
        payloadHash: stableHash(JSON.stringify(payload)),
        fetchedAt: cycle.deadlineAt,
        lockedAt: cycle.lockedAt,
      });
    }
  });

  return { predictions, results, snapshots };
}

/**
 * Ranks the universe for one student, one horizon, one week.
 *
 * Three forces decide a pick: how much the student trusts the baseline score,
 * how much genuine skill they have (which nudges them towards names that did
 * work out), and how much they simply repeat last horizon's picks.
 */
function rankCandidates(
  profile: StudentProfile,
  area: ResearchArea,
  horizon: Horizon,
  cycleDate: string,
  featureIndex: Map<string, StockFeatureRow>,
  outcomes: Map<string, number | null>,
  previousPicks: Set<string>,
  rng: Rng,
): PickCandidate[] {
  const skill = Math.max(
    0,
    profile.skill[area] + rng.normal(0, profile.volatility * 0.5),
  );

  const candidates: PickCandidate[] = STOCK_UNIVERSE.map((stock) => {
    const row = featureIndex.get(`${stock.ticker}:${cycleDate}`);
    const baselineScore = row?.baselineInvestmentScore ?? 0.5;
    const baseRate = baseRateProbability(stock, HORIZON_CALENDAR_DAYS[horizon], TARGET_RETURN);
    const forwardReturn = outcomes.get(stock.ticker) ?? null;

    // Skill expresses itself as knowing which names will work. Without a known
    // outcome (still-active horizon) it falls back to the honest base rate.
    const outcomeSignal =
      forwardReturn === null
        ? baseRate
        : forwardReturn >= TARGET_RETURN
          ? 1
          : forwardReturn > 0
            ? 0.45
            : 0;

    const attractiveness =
      profile.baselineAffinity * baselineScore +
      skill * outcomeSignal * 1.6 +
      (1 - profile.baselineAffinity) * baseRate * 2 +
      (previousPicks.has(stock.ticker) ? profile.horizonOverlap * 0.6 : 0) +
      rng.normal(0, 0.22);

    return { ticker: stock.ticker, baselineScore, baseRate, forwardReturn, attractiveness };
  });

  return candidates.sort((a, b) => b.attractiveness - a.attractiveness);
}

/**
 * The probability the student publishes.
 *
 * Starts at the honest base rate, moves towards the truth in proportion to
 * skill, then gets distorted by the student's confidence bias. That distortion
 * is exactly what the Brier score and the calibration chart expose.
 */
function statedProbability(
  profile: StudentProfile,
  area: ResearchArea,
  candidate: PickCandidate,
  outcome: number | null,
  rng: Rng,
): number {
  const skill = Math.min(Math.max(profile.skill[area], 0), 1);
  const truth = outcome === null ? candidate.baseRate : outcome >= TARGET_RETURN ? 1 : 0;
  const informed = candidate.baseRate + skill * 0.62 * (truth - candidate.baseRate);

  // Overconfidence pushes probabilities towards certainty rather than simply
  // scaling them. Scaling a 6% base rate by 1.5 is still a modest 9% claim and
  // would barely dent the Brier score; pushing towards 1 is what real
  // overconfidence looks like and is what calibration is supposed to catch.
  const bias = profile.confidence[area] - 1;
  const distorted =
    bias >= 0 ? informed + bias * (1 - informed) * 0.75 : informed * (1 + bias * 0.85);

  const noisy = distorted + rng.normal(0, 0.045 + profile.volatility * 0.1);
  return Math.min(Math.max(noisy, 0.02), 0.97);
}

const THESIS_TEMPLATES = [
  "Cheap on {metric} versus its own five-year band while {driver} keeps compounding.",
  "{driver} is not in consensus estimates yet; the {metric} gap to peers should close.",
  "Operating leverage is turning: {driver} with {metric} still below the sector median.",
  "Post-earnings drift setup — {driver} and analysts are behind on {metric}.",
  "Quality compounder trading at a discount: {metric} is attractive and {driver}.",
];

const DRIVERS = [
  "free cash flow conversion is improving",
  "revenue growth reaccelerated last quarter",
  "margins expanded for the third quarter running",
  "the guidance revision was upward",
  "ROIC keeps widening against peers",
  "the buyback is shrinking the share count",
];

const METRICS = ["EV/EBITDA", "forward P/E", "FCF yield", "price/sales", "PEG"];

const RISK_TEMPLATES = [
  "Multiple compression if rates stay higher for longer.",
  "Earnings date falls inside the horizon; a miss breaks the thesis.",
  "Momentum crowding — a factor unwind would hit this name first.",
  "Concentrated customer base makes revenue lumpy quarter to quarter.",
  "Regulatory headlines could re-rate the sector regardless of fundamentals.",
  "High volatility means the +10% target and a −10% drawdown are equally likely.",
];

function thesisFor(candidate: PickCandidate, horizon: Horizon, area: ResearchArea, rng: Rng): string {
  const template = rng.pick(THESIS_TEMPLATES);
  const text = template
    .replace("{driver}", rng.pick(DRIVERS))
    .replace("{metric}", rng.pick(METRICS));
  return `[${area} · ${horizon}] ${text}`;
}

function risksFor(candidate: PickCandidate, rng: Rng): string {
  return rng.pick(RISK_TEMPLATES);
}

/** Stable non-cryptographic digest, used as the snapshot fingerprint. */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
  );
}

let cached: MockDataset | null = null;

export function generateMockDataset(options?: {
  seed?: string;
  anchorDate?: string;
  cycles?: number;
}): MockDataset {
  const seed = options?.seed ?? MOCK_SEED;
  const anchorDate = options?.anchorDate ?? ANCHOR_DATE;
  const cycleCount = options?.cycles ?? CYCLE_COUNT;

  const cycles = buildCycles(anchorDate, cycleCount);
  const firstCycleDate = (cycles[0] as PredictionCycle).deadlineAt.slice(0, 10);
  const historyStart = toIsoDate(addDays(parseIsoDate(firstCycleDate), -HISTORY_LEAD_DAYS));

  const series = buildPriceSeries(historyStart, anchorDate, seed);
  const cycleDates = cycles.map((cycle) =>
    toIsoDate(nearestMarketDay(parseIsoDate(cycle.deadlineAt.slice(0, 10)), -1)),
  );
  const features = buildFeatureRows(series, cycleDates, seed);
  const students = buildStudents();
  const modelVersions = buildModelVersions(cycles);
  const integrations = buildIntegrations(new Rng(`${seed}:integrations`), cycles);
  const { predictions, results, snapshots } = buildPredictions(
    series,
    features,
    cycles,
    modelVersions,
    anchorDate,
  );

  return {
    seed,
    anchorDate,
    generatedAt: `${anchorDate}T09:00:00.000Z`,
    stocks: STOCK_UNIVERSE.map(toStock),
    prices: series.rows,
    benchmark: series.dates.map((date, index) => ({
      date,
      close: series.benchmark[index] as number,
    })),
    features,
    students,
    integrations,
    modelVersions,
    cycles,
    snapshots,
    predictions,
    results,
  };
}

/** Memoised accessor — the generator runs once per process. */
export function mockDataset(): MockDataset {
  if (!cached) cached = generateMockDataset();
  return cached;
}

export { stockProfile };
