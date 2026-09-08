import type { Horizon, ResearchArea } from "@/config/challenge";

/** ------------------------------------------------------------------ people */

export type IntegrationStatus = "healthy" | "error" | "timeout" | "invalid" | "unknown";

export type ParticipantKind = "student" | "influencer";

export interface StudentIntegration {
  studentId: string;
  baseUrl: string;
  predictionsEndpoint: string;
  healthEndpoint: string | null;
  /** Name of the env var holding the key. The key itself never leaves the server. */
  apiKeyEnvVar: string | null;
  enabled: boolean;
  lastFetchAt: string | null;
  lastStatus: IntegrationStatus;
  lastError: string | null;
  lastLatencyMs: number | null;
}

export interface Student {
  id: string;
  name: string;
  handle: string;
  avatarSeed: string;
  joinedAt: string;
  kind: ParticipantKind;
}

export interface ModelVersion {
  id: string;
  studentId: string;
  version: string;
  name: string;
  researchArea: ResearchArea;
  approach: string;
  createdAt: string;
  retiredAt: string | null;
}

/** ------------------------------------------------------------------ cycles */

export type CycleStatus = "open" | "locked" | "resolved";

export interface PredictionCycle {
  id: string;
  label: string;
  weekNumber: number;
  year: number;
  opensAt: string;
  deadlineAt: string;
  lockedAt: string | null;
  status: CycleStatus;
}

export interface PredictionSnapshot {
  id: string;
  studentId: string;
  cycleId: string;
  modelVersionId: string;
  rawPayload: unknown;
  payloadHash: string;
  fetchedAt: string;
  lockedAt: string | null;
}

/** ------------------------------------------------------------- predictions */

export type PredictionStatus = "active" | "resolved" | "void";

export interface Prediction {
  id: string;
  snapshotId: string;
  studentId: string;
  cycleId: string;
  modelVersionId: string;
  ticker: string;
  horizon: Horizon;
  rank: number;
  probability: number;
  expectedReturn: number;
  targetPrice: number | null;
  investmentThesis: string | null;
  risks: string | null;
  /** Optional evidence URL supplied with the immutable snapshot. */
  sourceUrl?: string | null;
  predictionDate: string;
  resolutionDate: string;
  status: PredictionStatus;
}

export interface PredictionResult {
  predictionId: string;
  predictionPrice: number;
  resolutionPrice: number;
  realizedReturn: number;
  benchmarkReturn: number;
  alpha: number;
  hitTarget: boolean;
  resolvedAt: string;
}

/** A prediction joined with its outcome, which is what the UI almost always wants. */
export interface ResolvedPrediction extends Prediction {
  result: PredictionResult | null;
}

/** ----------------------------------------------------------------- market */

export interface Stock {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  country: string;
  marketCap: number;
  employees: number;
  peerGroup: string[];
}

export interface MarketPrice {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
}

/** One row of the teaching dataset: a ticker as known on a given date. */
export interface StockFeatureRow {
  ticker: string;
  snapshotDate: string;

  // market
  close: number;
  return1d: number;
  return1w: number;
  return1m: number;
  momentum1w: number;
  momentum1m: number;
  momentum3m: number;
  momentum6m: number;
  volatility30d: number;
  volatility90d: number;
  drawdown: number;
  distance52wHigh: number;
  distance52wLow: number;
  volumeChange: number;

  // valuation
  peRatio: number;
  forwardPe: number;
  pegRatio: number;
  priceToSales: number;
  priceToBook: number;
  evEbitda: number;
  evSales: number;
  fcfYield: number;
  earningsYield: number;

  // growth
  revenue: number;
  revenueGrowthYoy: number;
  ebitda: number;
  ebitdaGrowthYoy: number;
  eps: number;
  epsGrowthYoy: number;
  fcf: number;
  fcfGrowthYoy: number;

  // profitability
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  roic: number;

  // financial health
  cash: number;
  totalDebt: number;
  netDebt: number;
  debtToEquity: number;
  netDebtEbitda: number;
  currentRatio: number;
  quickRatio: number;
  interestCoverage: number;

  // earnings
  earningsDate: string;
  epsEstimate: number;
  epsActual: number;
  epsSurprisePct: number;
  revenueEstimate: number;
  revenueActual: number;
  revenueSurprisePct: number;
  guidanceDirection: "up" | "flat" | "down";
  earningsSentiment: number;
  managementConfidence: number;

  // competitors
  peVsPeers: number;
  evEbitdaVsPeers: number;
  growthVsPeers: number;
  marginVsPeers: number;
  roicVsPeers: number;
  sectorRelativePe: number;
  sectorRelativeGrowth: number;
  sectorRelativeRoic: number;

  // news / sentiment
  newsSentiment7d: number;
  newsSentiment30d: number;
  positiveNewsCount: number;
  negativeNewsCount: number;
  analystUpgrades30d: number;
  analystDowngrades30d: number;

  // analyst
  analystRating: number;
  targetPriceConsensus: number;
  targetUpside: number;
  numberOfAnalysts: number;

  // macro
  sp500Return1m: number;
  nasdaqReturn1m: number;
  sectorReturn1m: number;
  interestRate: number;
  inflation: number;
  marketRegime: "risk-on" | "neutral" | "risk-off";

  // derived scores (the reference baseline handed to students)
  valuationScore: number;
  growthScore: number;
  qualityScore: number;
  financialHealthScore: number;
  momentumScore: number;
  earningsScore: number;
  baselineInvestmentScore: number;
}

/** ---------------------------------------------------------------- metrics */

export interface StudentMetrics {
  studentId: string;
  totalPredictions: number;
  resolvedPredictions: number;
  activePredictions: number;
  hits: number;
  hitRate: number;
  averageReturn: number;
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  averageAlpha: number;
  averageProbability: number;
  brierScore: number;
  calibrationError: number;
  consistency: number;
}

export interface LeaderboardEntry {
  rank: number;
  previousRank: number | null;
  student: Student;
  modelVersion: ModelVersion | null;
  metrics: StudentMetrics;
  /** Championship points: one per resolved pick that reached +10%. */
  score: number;
  components: Record<string, number>;
  provisional: boolean;
}

export interface CalibrationBin {
  lower: number;
  upper: number;
  label: string;
  count: number;
  predictedProbability: number;
  observedRate: number;
}

/** -------------------------------------------------------------- consensus */

export interface ConsensusRow {
  ticker: string;
  stock: Stock;
  studentCount: number;
  predictionCount: number;
  averageProbability: number;
  medianProbability: number;
  maxProbability: number;
  minProbability: number;
  probabilityStdDev: number;
  averageExpectedReturn: number;
  byHorizon: Record<Horizon, number>;
  resolvedHitRate: number | null;
}
