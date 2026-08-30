import { describe, expect, it } from "vitest";

import { POINTS_PER_HIT, TARGET_RETURN } from "@/config/challenge";
import { calculatePredictionOutcome, pointsForPick } from "@/lib/predictions/outcome";
import { prediction, resolved } from "./helpers";

describe("calculatePredictionOutcome", () => {
  it("marks a +10% close as a hit", () => {
    const outcome = calculatePredictionOutcome(100, 110);
    expect(outcome.realizedReturn).toBeCloseTo(0.1);
    expect(outcome.hitTarget).toBe(true);
  });

  it("marks a close just under the target as a miss", () => {
    const outcome = calculatePredictionOutcome(100, 109.9);
    expect(outcome.hitTarget).toBe(false);
    expect(outcome.realizedReturn).toBeLessThan(TARGET_RETURN);
  });

  it("uses close-to-close return, not the high", () => {
    const outcome = calculatePredictionOutcome(50, 54);
    expect(outcome.realizedReturn).toBeCloseTo(0.08);
    expect(outcome.hitTarget).toBe(false);
  });

  it("computes alpha against the benchmark", () => {
    const outcome = calculatePredictionOutcome(100, 115, 0.05);
    expect(outcome.realizedReturn).toBeCloseTo(0.15);
    expect(outcome.alpha).toBeCloseTo(0.1);
    expect(outcome.benchmarkReturn).toBe(0.05);
  });

  it("rejects non-positive prices", () => {
    expect(() => calculatePredictionOutcome(0, 110)).toThrow(/positive/);
    expect(() => calculatePredictionOutcome(100, -1)).toThrow(/positive/);
  });
});

describe("pointsForPick", () => {
  it("awards one point on a hit", () => {
    expect(pointsForPick(resolved(0.7, true))).toBe(POINTS_PER_HIT);
  });

  it("awards zero on a miss", () => {
    expect(pointsForPick(resolved(0.7, false))).toBe(0);
  });

  it("does not score an open horizon", () => {
    expect(pointsForPick(prediction())).toBeNull();
  });
});
