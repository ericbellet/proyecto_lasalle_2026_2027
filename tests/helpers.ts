import type { Horizon } from "@/config/challenge";
import type { ResolvedPrediction, StudentMetrics } from "@/lib/types";

let counter = 0;

export function prediction(overrides: Partial<ResolvedPrediction> = {}): ResolvedPrediction {
  counter += 1;
  const id = overrides.id ?? `pred-${counter}`;
  return {
    id,
    snapshotId: "snap-1",
    studentId: "student-01",
    cycleId: "2026-W10",
    modelVersionId: "student-01-v1",
    ticker: "AAPL",
    horizon: "1M",
    rank: 1,
    probability: 0.5,
    expectedReturn: 0.12,
    targetPrice: null,
    investmentThesis: null,
    risks: null,
    predictionDate: "2026-03-09",
    resolutionDate: "2026-04-08",
    status: overrides.result ? "resolved" : "active",
    result: null,
    ...overrides,
  };
}

export function resolved(
  probability: number,
  hit: boolean,
  realizedReturn = hit ? 0.14 : 0.02,
  extras: Partial<ResolvedPrediction> = {},
): ResolvedPrediction {
  return prediction({
    probability,
    expectedReturn: realizedReturn,
    status: "resolved",
    result: {
      predictionId: extras.id ?? `pred-r-${++counter}`,
      predictionPrice: 100,
      resolutionPrice: 100 * (1 + realizedReturn),
      realizedReturn,
      benchmarkReturn: 0.03,
      alpha: realizedReturn - 0.03,
      hitTarget: hit,
      resolvedAt: "2026-04-08T16:00:00.000Z",
    },
    ...extras,
  });
}

export function metrics(overrides: Partial<StudentMetrics> = {}): StudentMetrics {
  return {
    studentId: "student-01",
    totalPredictions: 40,
    resolvedPredictions: 30,
    activePredictions: 10,
    hits: 12,
    hitRate: 0.4,
    averageReturn: 0.08,
    medianReturn: 0.06,
    bestReturn: 0.22,
    worstReturn: -0.05,
    averageAlpha: 0.02,
    averageProbability: 0.45,
    brierScore: 0.2,
    calibrationError: 0.08,
    consistency: 0.7,
    ...overrides,
  };
}

export function byHorizon(
  horizon: Horizon,
  probability: number,
  hit: boolean,
): ResolvedPrediction {
  return resolved(probability, hit, hit ? 0.14 : 0.02, { horizon });
}
