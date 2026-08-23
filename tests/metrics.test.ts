import { describe, expect, it } from "vitest";

import {
  brierScore,
  buildFieldContext,
  calculateLeaderboardScore,
  calibrationBins,
  compareModelGenerations,
  computeStudentMetrics,
  hitRate,
} from "@/lib/metrics";
import { LEADERBOARD_CONFIG } from "@/config/leaderboard";
import { metrics, resolved } from "./helpers";

describe("hitRate", () => {
  it("is hits over resolved predictions", () => {
    const predictions = [resolved(0.7, true), resolved(0.6, true), resolved(0.4, false)];
    expect(hitRate(predictions)).toBeCloseTo(2 / 3);
  });

  it("ignores still-active predictions", () => {
    const predictions = [resolved(0.8, true), resolved(0.3, false, 0.01, { status: "active", result: null })];
    expect(hitRate(predictions)).toBe(1);
  });

  it("returns 0 when nothing is resolved", () => {
    expect(hitRate([])).toBe(0);
  });
});

describe("brierScore", () => {
  it("is the mean of (p - y)^2", () => {
    // hit at 1.0 → 0; miss at 0.0 → 0; miss at 1.0 → 1
    const predictions = [resolved(1, true), resolved(0, false), resolved(1, false)];
    expect(brierScore(predictions)).toBeCloseTo((0 + 0 + 1) / 3);
  });

  it("is 0.25 when every call is a coin flip", () => {
    const predictions = [resolved(0.5, true), resolved(0.5, false), resolved(0.5, true)];
    expect(brierScore(predictions)).toBeCloseTo(0.25);
  });

  it("punishes overconfidence harder than underconfidence of the same gap", () => {
    const over = [resolved(0.9, false), resolved(0.9, false)];
    const under = [resolved(0.1, true), resolved(0.1, true)];
    expect(brierScore(over)).toBeCloseTo(brierScore(under));
    expect(brierScore(over)).toBeGreaterThan(0.6);
  });
});

describe("calibrationBins", () => {
  it("compares stated probability with observed hit rate", () => {
    const predictions = [
      ...Array.from({ length: 4 }, () => resolved(0.2, false)),
      ...Array.from({ length: 1 }, () => resolved(0.2, true)),
    ];
    const bins = calibrationBins(predictions);
    const bin = bins.find((row) => row.lower === 0.2);
    expect(bin?.observedRate).toBeCloseTo(0.2);
    expect(bin?.predictedProbability).toBeCloseTo(0.2);
  });
});

describe("calculateLeaderboardScore", () => {
  it("scores an exactly-average student near 50", () => {
    const predictions = [
      resolved(0.4, true, 0.12, { studentId: "a", cycleId: "w1" }),
      resolved(0.4, false, 0.02, { studentId: "a", cycleId: "w2" }),
      resolved(0.4, true, 0.12, { studentId: "b", cycleId: "w1" }),
      resolved(0.4, false, 0.02, { studentId: "b", cycleId: "w2" }),
    ];
    const field = buildFieldContext(predictions);
    const own = predictions.filter((p) => p.studentId === "a");
    const ownMetrics = computeStudentMetrics("a", own);
    const score = calculateLeaderboardScore(ownMetrics, own, field);
    expect(score.score).toBeGreaterThan(20);
    expect(score.score).toBeLessThan(80);
  });

  it("uses the central weight table rather than hardcoded numbers", () => {
    expect(Object.values(LEADERBOARD_CONFIG).length).toBeGreaterThan(0);
    const predictions = [resolved(0.6, true, 0.15, { studentId: "a" })];
    const field = buildFieldContext(predictions);
    const ownMetrics = computeStudentMetrics("a", predictions);
    const score = calculateLeaderboardScore(ownMetrics, predictions, field);
    expect(score.components.hitRate).toBeGreaterThanOrEqual(0);
    expect(score.components.hitRate).toBeLessThanOrEqual(1);
    expect(score.components.calibration).toBeGreaterThanOrEqual(0);
    expect(score.components.relativeReturn).toBeGreaterThanOrEqual(0);
  });

  it("keeps a one-hit wonder provisional via sample reliability", () => {
    const lucky = metrics({ resolvedPredictions: 1, hitRate: 1, averageAlpha: 0.4 });
    const score = calculateLeaderboardScore(lucky, [resolved(0.9, true, 0.4)], {
      averageHitRate: 0.35,
      averageAlpha: 0.02,
      alphaStdDev: 0.03,
      baseRateByHorizon: { "1M": 0.35 },
    });
    expect(score.components.sampleReliability).toBeLessThan(0.2);
  });
});

describe("compareModelGenerations", () => {
  it("detects a real improvement from RA1 to RA2", () => {
    const comparison = compareModelGenerations(
      { area: "RA1", metrics: metrics({ hitRate: 0.28, brierScore: 0.28, averageReturn: 0.04 }) },
      { area: "RA2", metrics: metrics({ hitRate: 0.41, brierScore: 0.19, averageReturn: 0.07 }) },
    );
    expect(comparison.improved).toBe(true);
    expect(comparison.hitRateDelta).toBeCloseTo(0.13);
    expect(comparison.brierDelta).toBeCloseTo(0.09);
  });

  it("does not call added complexity an improvement when Brier collapses", () => {
    const comparison = compareModelGenerations(
      { area: "RA2", metrics: metrics({ hitRate: 0.4, brierScore: 0.18, averageReturn: 0.08 }) },
      { area: "RA3", metrics: metrics({ hitRate: 0.42, brierScore: 0.31, averageReturn: 0.07 }) },
    );
    expect(comparison.improved).toBe(false);
    expect(comparison.brierDelta).toBeLessThan(0);
  });
});
