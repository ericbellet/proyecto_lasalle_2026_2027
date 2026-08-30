import { POINTS_PER_HIT, TARGET_RETURN } from "@/config/challenge";
import type { ResolvedPrediction } from "@/lib/types";

/**
 * The arithmetic that turns two prices into a scored outcome.
 *
 * Isolated so the resolver, the seed and the tests all use the same formula:
 * a close-to-close return, alpha against a benchmark, and a hit at +10%.
 */
export interface PredictionOutcome {
  predictionPrice: number;
  resolutionPrice: number;
  realizedReturn: number;
  benchmarkReturn: number;
  alpha: number;
  hitTarget: boolean;
}

export function calculatePredictionOutcome(
  predictionPrice: number,
  resolutionPrice: number,
  benchmarkReturn = 0,
): PredictionOutcome {
  if (predictionPrice <= 0) {
    throw new Error("predictionPrice must be a positive number");
  }
  if (resolutionPrice <= 0) {
    throw new Error("resolutionPrice must be a positive number");
  }

  const realizedReturn = (resolutionPrice - predictionPrice) / predictionPrice;

  return {
    predictionPrice,
    resolutionPrice,
    realizedReturn,
    benchmarkReturn,
    alpha: realizedReturn - benchmarkReturn,
    hitTarget: realizedReturn >= TARGET_RETURN,
  };
}

/**
 * Championship points for one pick. `null` while the horizon is still open:
 * active predictions do not score, they also do not count as a miss.
 */
export function pointsForPick(prediction: ResolvedPrediction): number | null {
  if (!prediction.result) return null;
  return prediction.result.hitTarget ? POINTS_PER_HIT : 0;
}
