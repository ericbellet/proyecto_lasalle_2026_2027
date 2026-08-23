import type { ResearchArea } from "@/config/challenge";
import type { StudentMetrics } from "@/lib/types";

export interface GenerationSnapshot {
  area: ResearchArea;
  metrics: StudentMetrics;
}

export interface GenerationComparison {
  from: ResearchArea;
  to: ResearchArea;
  hitRateDelta: number;
  brierDelta: number;
  returnDelta: number;
  /** Hit rate rose and Brier did not get materially worse. */
  improved: boolean;
}

/**
 * Did a later model generation actually beat an earlier one?
 *
 * Used for the "Best model improvement" award and for the RA1 vs RA2 vs RA3
 * question that structures the course. A lower Brier is better, so `brierDelta`
 * is earlier − later (positive means the probabilities got more honest).
 */
export function compareModelGenerations(
  earlier: GenerationSnapshot,
  later: GenerationSnapshot,
): GenerationComparison {
  const hitRateDelta = later.metrics.hitRate - earlier.metrics.hitRate;
  const brierDelta = earlier.metrics.brierScore - later.metrics.brierScore;
  const returnDelta = later.metrics.averageReturn - earlier.metrics.averageReturn;

  return {
    from: earlier.area,
    to: later.area,
    hitRateDelta,
    brierDelta,
    returnDelta,
    improved: hitRateDelta > 0 && brierDelta >= -0.02,
  };
}
