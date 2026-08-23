import type { ResearchArea } from "@/config/challenge";

/**
 * The sixteen mock students.
 *
 * Each one carries a behavioural profile that the generator turns into
 * predictions. The profiles are deliberately spread out — a strong picker with
 * terrible calibration must be able to lose to a moderate picker who states
 * honest probabilities, otherwise the leaderboard formula is never exercised.
 */

export interface StudentProfile {
  id: string;
  name: string;
  handle: string;
  archetype: string;
  /** Ability to pick genuinely rising names, per research area. 0 = coin flip. */
  skill: Record<ResearchArea, number>;
  /**
   * Multiplier applied to the true probability before it is published.
   * > 1 is overconfident, < 1 is underconfident, 1 is honest.
   */
  confidence: Record<ResearchArea, number>;
  /** Week-to-week variance in skill. High values produce spiky records. */
  volatility: number;
  /** 1 follows the baseline score closely, 0 ignores it entirely. */
  baselineAffinity: number;
  /** How much the same tickers repeat across the four horizons. */
  horizonOverlap: number;
  models: Record<ResearchArea, { version: string; name: string; approach: string }>;
}

export const STUDENT_PROFILES: StudentProfile[] = [
  {
    id: "student-01",
    name: "Laura García",
    handle: "lgarcia",
    archetype: "Steady improver — weak baseline, excellent agents",
    skill: { RA1: 0.24, RA2: 0.46, RA3: 0.62 },
    confidence: { RA1: 1.22, RA2: 1.05, RA3: 0.99 },
    volatility: 0.1,
    baselineAffinity: 0.7,
    horizonOverlap: 0.35,
    models: {
      RA1: { version: "v1", name: "Weighted Value Score", approach: "Hand-tuned 7-factor linear score over the data lake" },
      RA2: { version: "v2", name: "XGBoost Multi-Horizon", approach: "Gradient boosting per horizon on point-in-time features" },
      RA3: { version: "v3", name: "Agent Committee", approach: "Five specialised agents feeding an investment committee" },
    },
  },
  {
    id: "student-02",
    name: "Carlos Mendoza",
    handle: "cmendoza",
    archetype: "High returns, badly overconfident",
    skill: { RA1: 0.34, RA2: 0.48, RA3: 0.52 },
    confidence: { RA1: 1.48, RA2: 1.42, RA3: 1.38 },
    volatility: 0.18,
    baselineAffinity: 0.35,
    horizonOverlap: 0.62,
    models: {
      RA1: { version: "v1", name: "Momentum Tilt Score", approach: "Momentum-heavy weighting with a valuation penalty" },
      RA2: { version: "v2", name: "LightGBM Ranker", approach: "Learning-to-rank over 60 engineered features" },
      RA3: { version: "v3", name: "Market + News Duo", approach: "Two agents: market regime and news sentiment" },
    },
  },
  {
    id: "student-03",
    name: "María Fernández",
    handle: "mfernandez",
    archetype: "Moderate returns, outstanding calibration",
    skill: { RA1: 0.28, RA2: 0.38, RA3: 0.44 },
    confidence: { RA1: 1.0, RA2: 0.98, RA3: 0.99 },
    volatility: 0.06,
    baselineAffinity: 0.82,
    horizonOverlap: 0.28,
    models: {
      RA1: { version: "v1", name: "Balanced Fundamental Score", approach: "Equal-weight z-scores across six factor blocks" },
      RA2: { version: "v2", name: "Calibrated Logistic", approach: "Logistic regression with isotonic calibration" },
      RA3: { version: "v3", name: "Fundamental Analyst Agent", approach: "Single deep fundamental agent with warehouse tools" },
    },
  },
  {
    id: "student-04",
    name: "Adrián Ruiz",
    handle: "aruiz",
    archetype: "One spectacular call, no consistency",
    skill: { RA1: 0.12, RA2: 0.2, RA3: 0.3 },
    confidence: { RA1: 1.3, RA2: 1.25, RA3: 1.15 },
    volatility: 0.42,
    baselineAffinity: 0.2,
    horizonOverlap: 0.75,
    models: {
      RA1: { version: "v1", name: "Contrarian Score", approach: "Buys the worst momentum decile on mean reversion" },
      RA2: { version: "v2", name: "Random Forest", approach: "Untuned random forest on raw warehouse columns" },
      RA3: { version: "v3", name: "Single LLM Prompt", approach: "One prompt with the full feature table pasted in" },
    },
  },
  {
    id: "student-05",
    name: "Nadia Bouzid",
    handle: "nbouzid",
    archetype: "Stable, disciplined, strong Brier",
    skill: { RA1: 0.3, RA2: 0.44, RA3: 0.5 },
    confidence: { RA1: 1.04, RA2: 1.0, RA3: 0.97 },
    volatility: 0.07,
    baselineAffinity: 0.75,
    horizonOverlap: 0.22,
    models: {
      RA1: { version: "v1", name: "Quality-First Score", approach: "ROIC and balance-sheet weighted composite" },
      RA2: { version: "v2", name: "Stacked Ensemble", approach: "Logistic + GBM stack with Platt scaling" },
      RA3: { version: "v3", name: "Committee with Debate", approach: "Agents argue, committee resolves disagreement" },
    },
  },
  {
    id: "student-06",
    name: "Pau Serrano",
    handle: "pserrano",
    archetype: "Underconfident — right more often than he claims",
    skill: { RA1: 0.32, RA2: 0.42, RA3: 0.48 },
    confidence: { RA1: 0.74, RA2: 0.79, RA3: 0.84 },
    volatility: 0.09,
    baselineAffinity: 0.68,
    horizonOverlap: 0.3,
    models: {
      RA1: { version: "v1", name: "Conservative Value Score", approach: "Deep-value screen with a hard debt filter" },
      RA2: { version: "v2", name: "Regularised Logistic", approach: "L2 logistic regression, few features, heavy CV" },
      RA3: { version: "v3", name: "Earnings Agent", approach: "Transcript-driven earnings agent plus ML prior" },
    },
  },
  {
    id: "student-07",
    name: "Sofía Ramírez",
    handle: "sramirez",
    archetype: "Strong all-round performer",
    skill: { RA1: 0.36, RA2: 0.52, RA3: 0.58 },
    confidence: { RA1: 1.08, RA2: 1.03, RA3: 1.01 },
    volatility: 0.11,
    baselineAffinity: 0.6,
    horizonOverlap: 0.34,
    models: {
      RA1: { version: "v1", name: "Multi-Factor Perceptron", approach: "Hand-set weights framed as a single perceptron" },
      RA2: { version: "v2", name: "XGBoost + Features v2", approach: "Boosting on a 90-column point-in-time feature table" },
      RA3: { version: "v3", name: "Four-Agent Committee", approach: "Fundamental, earnings, competitor, market" },
    },
  },
  {
    id: "student-08",
    name: "Yusuf Karaca",
    handle: "ykaraca",
    archetype: "Momentum chaser — great in trends, punished in chop",
    skill: { RA1: 0.26, RA2: 0.34, RA3: 0.38 },
    confidence: { RA1: 1.32, RA2: 1.28, RA3: 1.2 },
    volatility: 0.3,
    baselineAffinity: 0.25,
    horizonOverlap: 0.68,
    models: {
      RA1: { version: "v1", name: "Pure Momentum", approach: "6-month momentum ranking, nothing else" },
      RA2: { version: "v2", name: "Momentum GBM", approach: "Boosting over technical features only" },
      RA3: { version: "v3", name: "Market Regime Agent", approach: "Regime classifier driving a momentum agent" },
    },
  },
  {
    id: "student-09",
    name: "Elena Kovács",
    handle: "ekovacs",
    archetype: "Slow starter, big RA2 jump",
    skill: { RA1: 0.14, RA2: 0.5, RA3: 0.54 },
    confidence: { RA1: 1.18, RA2: 1.02, RA3: 1.0 },
    volatility: 0.13,
    baselineAffinity: 0.55,
    horizonOverlap: 0.4,
    models: {
      RA1: { version: "v1", name: "First Attempt Score", approach: "Three factors, weights guessed" },
      RA2: { version: "v2", name: "Feature-Rich XGBoost", approach: "Airflow-built features, careful leakage audit" },
      RA3: { version: "v3", name: "RAG Research Agent", approach: "Retrieval over filings feeding the ML prior" },
    },
  },
  {
    id: "student-10",
    name: "Bruno Oliveira",
    handle: "boliveira",
    archetype: "Peaked in RA2, agents made it worse",
    skill: { RA1: 0.3, RA2: 0.47, RA3: 0.33 },
    confidence: { RA1: 1.06, RA2: 1.02, RA3: 1.24 },
    volatility: 0.14,
    baselineAffinity: 0.5,
    horizonOverlap: 0.45,
    models: {
      RA1: { version: "v1", name: "Cash-Flow Score", approach: "FCF yield and reinvestment weighted composite" },
      RA2: { version: "v2", name: "Tuned LightGBM", approach: "Optuna-tuned boosting, strong CV discipline" },
      RA3: { version: "v3", name: "Seven-Agent Swarm", approach: "Large agent graph, weak grounding in the warehouse" },
    },
  },
  {
    id: "student-11",
    name: "Aisha Rahman",
    handle: "arahman",
    archetype: "Low variance, mid skill, honest probabilities",
    skill: { RA1: 0.27, RA2: 0.36, RA3: 0.43 },
    confidence: { RA1: 0.98, RA2: 1.0, RA3: 1.0 },
    volatility: 0.05,
    baselineAffinity: 0.78,
    horizonOverlap: 0.25,
    models: {
      RA1: { version: "v1", name: "Sector-Neutral Score", approach: "Z-scores computed within each sector" },
      RA2: { version: "v2", name: "Sector-Neutral GBM", approach: "Boosting with sector-relative features only" },
      RA3: { version: "v3", name: "Competitor Agent", approach: "Peer-comparison agent over warehouse tools" },
    },
  },
  {
    id: "student-12",
    name: "Marc Vidal",
    handle: "mvidal",
    archetype: "Aggressive, high variance, occasional brilliance",
    skill: { RA1: 0.22, RA2: 0.4, RA3: 0.51 },
    confidence: { RA1: 1.36, RA2: 1.3, RA3: 1.12 },
    volatility: 0.28,
    baselineAffinity: 0.3,
    horizonOverlap: 0.58,
    models: {
      RA1: { version: "v1", name: "Growth-At-Any-Price", approach: "Revenue growth dominant, valuation ignored" },
      RA2: { version: "v2", name: "Deep MLP", approach: "Small neural network, minimal regularisation" },
      RA3: { version: "v3", name: "Committee + Search", approach: "Agents with live web search for catalysts" },
    },
  },
  {
    id: "student-13",
    name: "Irene Castillo",
    handle: "icastillo",
    archetype: "Methodical, best calibration in the cohort",
    skill: { RA1: 0.29, RA2: 0.41, RA3: 0.47 },
    confidence: { RA1: 1.0, RA2: 0.99, RA3: 1.0 },
    volatility: 0.04,
    baselineAffinity: 0.8,
    horizonOverlap: 0.2,
    models: {
      RA1: { version: "v1", name: "Documented Weighted Score", approach: "Every weight justified in writing" },
      RA2: { version: "v2", name: "Calibrated Ensemble", approach: "Ensemble with explicit reliability diagrams" },
      RA3: { version: "v3", name: "Grounded Committee", approach: "Agents forced to cite warehouse rows" },
    },
  },
  {
    id: "student-14",
    name: "Tomás Aguirre",
    handle: "taguirre",
    archetype: "Below average, improves late",
    skill: { RA1: 0.1, RA2: 0.22, RA3: 0.39 },
    confidence: { RA1: 1.26, RA2: 1.18, RA3: 1.05 },
    volatility: 0.2,
    baselineAffinity: 0.4,
    horizonOverlap: 0.5,
    models: {
      RA1: { version: "v1", name: "Simple Score", approach: "Two factors, equal weights" },
      RA2: { version: "v2", name: "Decision Tree", approach: "Single tree, shallow depth" },
      RA3: { version: "v3", name: "Two-Agent Setup", approach: "Fundamental and market agents with a tie-break rule" },
    },
  },
  {
    id: "student-15",
    name: "Chiara Rossi",
    handle: "crossi",
    archetype: "Consistent mid-table, never spectacular",
    skill: { RA1: 0.25, RA2: 0.33, RA3: 0.4 },
    confidence: { RA1: 1.1, RA2: 1.06, RA3: 1.03 },
    volatility: 0.08,
    baselineAffinity: 0.65,
    horizonOverlap: 0.32,
    models: {
      RA1: { version: "v1", name: "Textbook Value Score", approach: "Classic value screen, lightly tuned" },
      RA2: { version: "v2", name: "Random Forest v2", approach: "Forest with feature-importance pruning" },
      RA3: { version: "v3", name: "Analyst Agent Pair", approach: "Fundamental and news agents, simple averaging" },
    },
  },
  {
    id: "student-16",
    name: "Diego Salazar",
    handle: "dsalazar",
    archetype: "Fast learner, strongest agent architecture",
    skill: { RA1: 0.2, RA2: 0.45, RA3: 0.66 },
    confidence: { RA1: 1.15, RA2: 1.04, RA3: 0.98 },
    volatility: 0.12,
    baselineAffinity: 0.45,
    horizonOverlap: 0.26,
    models: {
      RA1: { version: "v1", name: "Weighted Score v1", approach: "Six factors with documented normalisation" },
      RA2: { version: "v2", name: "Horizon-Specific Models", approach: "One calibrated model per horizon" },
      RA3: { version: "v3", name: "Investment Committee v3", approach: "Specialised agents, structured output, ML prior as a tool" },
    },
  },
];

export const STUDENT_COUNT = STUDENT_PROFILES.length;
