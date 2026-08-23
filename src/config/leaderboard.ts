/**
 * Leaderboard scoring configuration.
 *
 * The score is a weighted blend of five components, each normalised to [0, 1]
 * before weighting. Weights are declared once, here, and validated at module
 * load so a typo can never silently rescale the ranking.
 */

export type ScoreComponent =
  | "hitRate"
  | "calibration"
  | "relativeReturn"
  | "consistency"
  | "sampleReliability";

export const SCORE_WEIGHTS: Record<ScoreComponent, number> = {
  hitRate: 0.3,
  calibration: 0.25,
  relativeReturn: 0.25,
  consistency: 0.1,
  sampleReliability: 0.1,
};

const weightSum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`SCORE_WEIGHTS must sum to 1, got ${weightSum}`);
}

export const SCORE_COMPONENT_LABELS: Record<ScoreComponent, string> = {
  hitRate: "Hit rate",
  calibration: "Calibration",
  relativeReturn: "Relative return",
  consistency: "Consistency",
  sampleReliability: "Sample reliability",
};

export const LEADERBOARD_CONFIG = {
  /**
   * Below this many resolved predictions a student is shown as "provisional"
   * and excluded from the headline ranking. Stops a single lucky call from
   * winning the semester.
   */
  minResolvedForRanking: 12,

  /**
   * Number of resolved predictions at which the sample-reliability component
   * saturates at 1.0.
   */
  sampleSaturation: 60,

  /**
   * Floor for the alpha band used by the relative-return component. The band
   * normally tracks two cohort standard deviations; this stops a very tight
   * field from turning rounding noise into large score gaps.
   */
  relativeReturnBand: 0.02,

  /** Probability bins used by the calibration chart and the calibration error. */
  calibrationBins: 10,

  /** Final score is reported on a 0–100 scale. */
  scale: 100,
} as const;
