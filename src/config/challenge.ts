/**
 * Rules of the competition.
 *
 * Everything the platform treats as "the rules" lives here so that changing a
 * rule is a one-line edit rather than a search-and-replace across the codebase.
 */

export const HORIZONS = ["1W", "1M", "3M", "6M"] as const;
export type Horizon = (typeof HORIZONS)[number];

/** Calendar days used to project a prediction's resolution date. */
export const HORIZON_CALENDAR_DAYS: Record<Horizon, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 91,
  "6M": 182,
};

/**
 * Weekly job instant. Vercel Cron is UTC with minute precision (no seconds):
 * 23:59 Europe/Madrid in CEST (UTC+2) is 21:59 UTC → `59 21 * * 0`.
 *
 * The job is weekly, not nightly. 1M / 3M / 6M picks are scored the first
 * Sunday after their calendar `resolutionDate` has passed — the same run
 * checks every due pick, not only 1W.
 */
export const WEEKLY_LOCK = {
  utcDay: 0,
  utcHour: 21,
  utcMinute: 59,
} as const;

export const HORIZON_LABELS: Record<Horizon, string> = {
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "6M": "6 Months",
};

/**
 * A prediction is a "hit" when the realized return reaches this threshold.
 * The public ranking is built around this single number: one point per hit.
 */
export const TARGET_RETURN = 0.1;

/** Championship points awarded when a pick hits the target. */
export const POINTS_PER_HIT = 1;

/** Top N tickers a student submits per horizon, per cycle. */
export const PICKS_PER_HORIZON = 3;

/** Hard ceiling on submissions per student per cycle. */
export const MAX_PREDICTIONS_PER_CYCLE = HORIZONS.length * PICKS_PER_HORIZON;

/** Research areas of the course. Each one produces a new model generation. */
export const RESEARCH_AREAS = ["RA1", "RA2", "RA3"] as const;
export type ResearchArea = (typeof RESEARCH_AREAS)[number];

export const RESEARCH_AREA_LABELS: Record<ResearchArea, string> = {
  RA1: "RA1 · Data Lake & baseline score",
  RA2: "RA2 · Warehouse & machine learning",
  RA3: "RA3 · AI investment agents",
};

export const RESEARCH_AREA_SHORT: Record<ResearchArea, string> = {
  RA1: "Weighted score",
  RA2: "Machine learning",
  RA3: "AI agents",
};

/** Time windows offered by the leaderboard filter. `null` means "all history". */
export const LEADERBOARD_WINDOWS = [
  { id: "this-week", label: "This week", cycles: 1 },
  { id: "4-weeks", label: "4 weeks", cycles: 4 },
  { id: "8-weeks", label: "8 weeks", cycles: 8 },
  { id: "current-ra", label: "Current RA", cycles: null },
  { id: "semester", label: "Semester", cycles: null },
  { id: "all-time", label: "All time", cycles: null },
] as const;

export type LeaderboardWindowId = (typeof LEADERBOARD_WINDOWS)[number]["id"];

/** Championship and student pages default to the full record. */
export const DEFAULT_WINDOW: LeaderboardWindowId = "all-time";

/** The pick-by-pick board defaults to the current cycle so it stays readable. */
export const LEADERBOARD_DEFAULT_WINDOW: LeaderboardWindowId = "this-week";

export const CHALLENGE = {
  name: "LaSalle Investing",
  tagline: "Can data, machine learning and AI agents consistently beat the market?",
  targetReturn: TARGET_RETURN,
  picksPerHorizon: PICKS_PER_HORIZON,
  horizons: HORIZONS,
} as const;
