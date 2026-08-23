import { TARGET_RETURN } from "@/config/challenge";
import { LEADERBOARD_CONFIG, SCORE_WEIGHTS, type ScoreComponent } from "@/config/leaderboard";
import type { CalibrationBin, ResolvedPrediction, StudentMetrics } from "@/lib/types";

/**
 * Scoring engine.
 *
 * Every function here is pure and takes plain arrays, so the same code runs in
 * the seed script, in the API and in the tests. Nothing reads the database.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** A prediction is a hit when the realized return reached the target. */
export function isHit(realizedReturn: number): boolean {
  return realizedReturn >= TARGET_RETURN;
}

export function hitRate(predictions: ResolvedPrediction[]): number {
  const resolved = predictions.filter((p) => p.result);
  if (resolved.length === 0) return 0;
  const hits = resolved.filter((p) => p.result?.hitTarget).length;
  return hits / resolved.length;
}

/**
 * Brier score: the mean squared error of the stated probabilities.
 *
 *   (p - y)^2 averaged over predictions, where y is 1 for a hit.
 *
 * Lower is better. 0 is perfect, 0.25 is what you get by always saying 50%.
 */
export function brierScore(predictions: ResolvedPrediction[]): number {
  const resolved = predictions.filter((p) => p.result);
  if (resolved.length === 0) return 0;
  const total = resolved.reduce((acc, prediction) => {
    const outcome = prediction.result?.hitTarget ? 1 : 0;
    return acc + (prediction.probability - outcome) ** 2;
  }, 0);
  return total / resolved.length;
}

/**
 * Bucket predictions by stated probability and compare each bucket's average
 * claim against how often it actually happened. Empty bins are dropped.
 */
export function calibrationBins(
  predictions: ResolvedPrediction[],
  binCount = LEADERBOARD_CONFIG.calibrationBins,
): CalibrationBin[] {
  const resolved = predictions.filter((p) => p.result);
  const bins: CalibrationBin[] = [];

  for (let index = 0; index < binCount; index += 1) {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const inBin = resolved.filter((prediction) => {
      const probability = prediction.probability;
      return index === binCount - 1
        ? probability >= lower && probability <= upper
        : probability >= lower && probability < upper;
    });

    bins.push({
      lower,
      upper,
      label: `${Math.round(lower * 100)}–${Math.round(upper * 100)}%`,
      count: inBin.length,
      predictedProbability: mean(inBin.map((p) => p.probability)),
      observedRate: inBin.length === 0 ? 0 : inBin.filter((p) => p.result?.hitTarget).length / inBin.length,
    });
  }

  return bins.filter((bin) => bin.count > 0);
}

/**
 * Expected Calibration Error: how far the stated probabilities sit from the
 * observed frequencies, weighted by how many predictions fall in each bin.
 */
export function calibrationError(predictions: ResolvedPrediction[]): number {
  const bins = calibrationBins(predictions);
  const total = bins.reduce((acc, bin) => acc + bin.count, 0);
  if (total === 0) return 0;
  return bins.reduce(
    (acc, bin) => acc + (bin.count / total) * Math.abs(bin.predictedProbability - bin.observedRate),
    0,
  );
}

/**
 * Consistency measures whether a record is steady or spiky.
 *
 * Naively taking the spread of per-cycle hit rates does not work: with only a
 * dozen predictions a week, pure chance already produces a large spread. So we
 * compare the observed spread against the binomial spread you would expect from
 * an equally skilled but perfectly steady student, and only penalise the excess.
 */
export function consistency(predictions: ResolvedPrediction[]): number {
  const resolved = predictions.filter((p) => p.result);
  if (resolved.length === 0) return 0;

  const byCycle = new Map<string, ResolvedPrediction[]>();
  for (const prediction of resolved) {
    const bucket = byCycle.get(prediction.cycleId) ?? [];
    bucket.push(prediction);
    byCycle.set(prediction.cycleId, bucket);
  }
  if (byCycle.size < 3) return 0.5;

  const buckets = [...byCycle.values()];
  const cycleHitRates = buckets.map((bucket) => hitRate(bucket));
  const overallRate = hitRate(resolved);
  const averageBucketSize = resolved.length / buckets.length;

  const expectedSpread = Math.sqrt(
    Math.max(overallRate * (1 - overallRate), 1e-6) / Math.max(averageBucketSize, 1),
  );
  const excess = Math.max(standardDeviation(cycleHitRates) - expectedSpread, 0);

  // An excess spread of 0.2 above the noise floor is as erratic as it gets.
  return clamp(1 - excess / 0.2);
}

/** Grows from 0 to 1 as resolved predictions approach the saturation point. */
export function sampleReliability(
  resolvedCount: number,
  saturation = LEADERBOARD_CONFIG.sampleSaturation,
): number {
  if (resolvedCount <= 0) return 0;
  return clamp(Math.log1p(resolvedCount) / Math.log1p(saturation));
}

export function computeStudentMetrics(
  studentId: string,
  predictions: ResolvedPrediction[],
): StudentMetrics {
  const resolved = predictions.filter((p) => p.result);
  const returns = resolved.map((p) => p.result?.realizedReturn ?? 0);
  const alphas = resolved.map((p) => p.result?.alpha ?? 0);

  return {
    studentId,
    totalPredictions: predictions.length,
    resolvedPredictions: resolved.length,
    activePredictions: predictions.filter((p) => p.status === "active").length,
    hits: resolved.filter((p) => p.result?.hitTarget).length,
    hitRate: hitRate(predictions),
    averageReturn: mean(returns),
    medianReturn: median(returns),
    bestReturn: returns.length ? Math.max(...returns) : 0,
    worstReturn: returns.length ? Math.min(...returns) : 0,
    averageAlpha: mean(alphas),
    averageProbability: mean(predictions.map((p) => p.probability)),
    brierScore: brierScore(predictions),
    calibrationError: calibrationError(predictions),
    consistency: consistency(predictions),
  };
}

export interface LeaderboardScore {
  score: number;
  components: Record<ScoreComponent, number>;
  brierSkillScore: number;
}

/**
 * Cohort-wide reference numbers.
 *
 * Every component is scored against the field rather than against an absolute
 * constant. A +10% move in a week is rare and a +10% move in six months is
 * common, so an absolute hit-rate target would just rank students by how many
 * long-horizon picks they made. Comparing against the room removes that.
 */
export interface FieldContext {
  averageHitRate: number;
  averageAlpha: number;
  /**
   * Spread of *per-student average* alpha, not of individual predictions. Using
   * the per-prediction spread would be roughly ten times larger and would
   * flatten every student onto the same relative-return score.
   */
  alphaStdDev: number;
  /** Observed frequency of a hit per horizon — the "always guess the base rate" model. */
  baseRateByHorizon: Record<string, number>;
}

export function buildFieldContext(predictions: ResolvedPrediction[]): FieldContext {
  const resolved = predictions.filter((p) => p.result);

  const alphaByStudent = new Map<string, number[]>();
  for (const prediction of resolved) {
    const bucket = alphaByStudent.get(prediction.studentId) ?? [];
    bucket.push(prediction.result?.alpha ?? 0);
    alphaByStudent.set(prediction.studentId, bucket);
  }
  const studentAlphas = [...alphaByStudent.values()].map((values) => mean(values));

  const baseRateByHorizon: Record<string, number> = {};
  const byHorizon = new Map<string, ResolvedPrediction[]>();
  for (const prediction of resolved) {
    const bucket = byHorizon.get(prediction.horizon) ?? [];
    bucket.push(prediction);
    byHorizon.set(prediction.horizon, bucket);
  }
  for (const [horizon, bucket] of byHorizon) {
    baseRateByHorizon[horizon] = bucket.filter((p) => p.result?.hitTarget).length / bucket.length;
  }

  return {
    averageHitRate: hitRate(resolved),
    averageAlpha: mean(studentAlphas),
    alphaStdDev: standardDeviation(studentAlphas),
    baseRateByHorizon,
  };
}

export const EMPTY_FIELD: FieldContext = {
  averageHitRate: 0,
  averageAlpha: 0,
  alphaStdDev: 0,
  baseRateByHorizon: {},
};

/**
 * Brier Skill Score: how much better the student's probabilities are than
 * simply quoting the cohort's base rate for that horizon every single time.
 *
 *   BSS = 1 − brier / brier_reference
 *
 * Positive means the probabilities carry information. Zero means they are worth
 * no more than knowing how often a +10% move happens. Negative means they are
 * actively misleading, which is where overconfidence lands.
 */
export function brierSkillScore(
  predictions: ResolvedPrediction[],
  baseRateByHorizon: Record<string, number>,
): number {
  const resolved = predictions.filter((p) => p.result);
  if (resolved.length === 0) return 0;

  const reference =
    resolved.reduce((acc, prediction) => {
      const baseRate = baseRateByHorizon[prediction.horizon] ?? 0.25;
      const outcome = prediction.result?.hitTarget ? 1 : 0;
      return acc + (baseRate - outcome) ** 2;
    }, 0) / resolved.length;

  if (reference === 0) return 0;
  return 1 - brierScore(resolved) / reference;
}

/**
 * Blend the five normalised components into the headline 0–100 score.
 *
 * Each component is centred on 0.5 at the cohort average, so a student who is
 * exactly average lands near 50 and the spread across the class fills the range.
 */
export function calculateLeaderboardScore(
  metrics: StudentMetrics,
  predictions: ResolvedPrediction[],
  field: FieldContext,
): LeaderboardScore {
  const bss = brierSkillScore(predictions, field.baseRateByHorizon);
  // Two cohort standard deviations of alpha, floored so a very tight field does
  // not turn rounding noise into large score differences.
  const alphaBand = Math.max(2 * field.alphaStdDev, LEADERBOARD_CONFIG.relativeReturnBand);

  const components: Record<ScoreComponent, number> = {
    hitRate: clamp(metrics.hitRate / (2 * Math.max(field.averageHitRate, 0.02))),
    calibration: clamp(0.5 + bss * 2.5),
    relativeReturn: clamp(0.5 + (metrics.averageAlpha - field.averageAlpha) / (2 * alphaBand)),
    consistency: clamp(metrics.consistency),
    sampleReliability: sampleReliability(metrics.resolvedPredictions),
  };

  const weighted = (Object.keys(SCORE_WEIGHTS) as ScoreComponent[]).reduce(
    (acc, key) => acc + SCORE_WEIGHTS[key] * components[key],
    0,
  );

  return {
    score: Math.round(weighted * LEADERBOARD_CONFIG.scale * 10) / 10,
    components,
    brierSkillScore: Math.round(bss * 10000) / 10000,
  };
}

export { compareModelGenerations } from "@/lib/metrics/compare";
export type { GenerationComparison, GenerationSnapshot } from "@/lib/metrics/compare";

/**
 * How different a student's picks are across the four horizons. 1 means every
 * horizon holds a different basket, 0 means the same three tickers everywhere.
 */
export function horizonDiversityScore(predictions: ResolvedPrediction[]): number {
  const byHorizon = new Map<string, Set<string>>();
  for (const prediction of predictions) {
    const bucket = byHorizon.get(prediction.horizon) ?? new Set<string>();
    bucket.add(prediction.ticker);
    byHorizon.set(prediction.horizon, bucket);
  }
  const baskets = [...byHorizon.values()];
  if (baskets.length < 2) return 1;

  const overlaps: number[] = [];
  for (let i = 0; i < baskets.length; i += 1) {
    for (let j = i + 1; j < baskets.length; j += 1) {
      const a = baskets[i] as Set<string>;
      const b = baskets[j] as Set<string>;
      const intersection = [...a].filter((ticker) => b.has(ticker)).length;
      const union = new Set([...a, ...b]).size;
      overlaps.push(union === 0 ? 0 : intersection / union);
    }
  }
  return clamp(1 - mean(overlaps));
}
