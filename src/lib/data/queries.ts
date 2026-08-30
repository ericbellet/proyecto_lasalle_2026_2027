import {
  HORIZONS,
  POINTS_PER_HIT,
  RESEARCH_AREAS,
  type Horizon,
  type LeaderboardWindowId,
  type ResearchArea,
} from "@/config/challenge";
import { pointsForPick } from "@/lib/predictions/outcome";
import { LEADERBOARD_CONFIG } from "@/config/leaderboard";
import { getDataset, type Dataset } from "@/lib/data/dataset";
import {
  buildFieldContext,
  calculateLeaderboardScore,
  calibrationBins,
  computeStudentMetrics,
  horizonDiversityScore,
  mean,
  median,
  standardDeviation,
  type FieldContext,
} from "@/lib/metrics";
import { researchAreaForCycle } from "@/lib/mock/dataset";
import type {
  CalibrationBin,
  ConsensusRow,
  LeaderboardEntry,
  ModelVersion,
  Prediction,
  PredictionCycle,
  PredictionResult,
  PredictionSnapshot,
  ResolvedPrediction,
  Stock,
  StockFeatureRow,
  Student,
  StudentIntegration,
  StudentMetrics,
} from "@/lib/types";

/**
 * Everything the pages read.
 *
 * All functions take the dataset as an implicit dependency through
 * `getDataset()`, which is request-memoised, so a page rendering four of these
 * still only builds the world once.
 */

export type HorizonFilter = Horizon | "OVERALL";
export type AreaFilter = ResearchArea | "ALL";

export interface LeaderboardFilters {
  horizon?: HorizonFilter;
  window?: LeaderboardWindowId;
  researchArea?: AreaFilter;
  studentId?: string;
  ticker?: string;
  deadline?: string;
}

/** ------------------------------------------------------------- primitives */

function joinResults(
  predictions: Prediction[],
  results: PredictionResult[],
): ResolvedPrediction[] {
  const byId = new Map(results.map((result) => [result.predictionId, result]));
  return predictions.map((prediction) => ({
    ...prediction,
    result: byId.get(prediction.id) ?? null,
  }));
}

export const allPredictions = (dataset: Dataset): ResolvedPrediction[] =>
  joinResults(dataset.predictions, dataset.results);

/** Cycle ids selected by a leaderboard window, newest-last. */
export function cyclesInWindow(
  dataset: Dataset,
  window: LeaderboardWindowId = "all-time",
): Set<string> {
  const cycles = dataset.cycles;
  const take = (count: number) => cycles.slice(Math.max(cycles.length - count, 0));

  switch (window) {
    case "this-week":
      return new Set(take(1).map((cycle) => cycle.id));
    case "4-weeks":
      return new Set(take(4).map((cycle) => cycle.id));
    case "8-weeks":
      return new Set(take(8).map((cycle) => cycle.id));
    case "current-ra": {
      const currentArea = researchAreaForCycle(cycles.length - 1, cycles.length);
      return new Set(
        cycles
          .filter((_, index) => researchAreaForCycle(index, cycles.length) === currentArea)
          .map((cycle) => cycle.id),
      );
    }
    default:
      return new Set(cycles.map((cycle) => cycle.id));
  }
}

export function cyclesForArea(dataset: Dataset, area: AreaFilter): Set<string> {
  if (area === "ALL") return new Set(dataset.cycles.map((cycle) => cycle.id));
  return new Set(
    dataset.cycles
      .filter((_, index) => researchAreaForCycle(index, dataset.cycles.length) === area)
      .map((cycle) => cycle.id),
  );
}

export function areaOfCycle(dataset: Dataset, cycleId: string): ResearchArea {
  const index = dataset.cycles.findIndex((cycle) => cycle.id === cycleId);
  return researchAreaForCycle(Math.max(index, 0), dataset.cycles.length);
}

function applyFilters(
  dataset: Dataset,
  predictions: ResolvedPrediction[],
  filters: LeaderboardFilters,
): ResolvedPrediction[] {
  const windowCycles = cyclesInWindow(dataset, filters.window ?? "all-time");
  const areaCycles = cyclesForArea(dataset, filters.researchArea ?? "ALL");

  return predictions.filter((prediction) => {
    if (!windowCycles.has(prediction.cycleId)) return false;
    if (!areaCycles.has(prediction.cycleId)) return false;
    if (filters.horizon && filters.horizon !== "OVERALL" && prediction.horizon !== filters.horizon) {
      return false;
    }
    if (filters.studentId && prediction.studentId !== filters.studentId) return false;
    if (filters.ticker && prediction.ticker !== filters.ticker) return false;
    if (filters.deadline && prediction.resolutionDate.slice(0, 10) !== filters.deadline) return false;
    return true;
  });
}

/** --------------------------------------------------------------- overview */

export interface Overview {
  currentCycle: PredictionCycle | null;
  previousCycle: PredictionCycle | null;
  totalCycles: number;
  students: number;
  activeModels: number;
  activePredictions: number;
  resolvedPredictions: number;
  totalPredictions: number;
  hitRate: number;
  averageReturn: number;
  stocks: number;
  currentArea: ResearchArea;
  anchorDate: string;
}

export async function getOverview(): Promise<Overview> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);
  const resolved = predictions.filter((p) => p.result);
  const currentCycle = dataset.cycles[dataset.cycles.length - 1] ?? null;

  return {
    currentCycle,
    previousCycle: dataset.cycles[dataset.cycles.length - 2] ?? null,
    totalCycles: dataset.cycles.length,
    students: dataset.students.length,
    activeModels: currentCycle
      ? new Set(
          dataset.predictions
            .filter((p) => p.cycleId === currentCycle.id)
            .map((p) => p.modelVersionId),
        ).size
      : 0,
    activePredictions: predictions.filter((p) => p.status === "active").length,
    resolvedPredictions: resolved.length,
    totalPredictions: predictions.length,
    hitRate: resolved.length
      ? resolved.filter((p) => p.result?.hitTarget).length / resolved.length
      : 0,
    averageReturn: mean(resolved.map((p) => p.result?.realizedReturn ?? 0)),
    stocks: dataset.stocks.length,
    currentArea: currentCycle ? areaOfCycle(dataset, currentCycle.id) : "RA1",
    anchorDate: dataset.anchorDate,
  };
}

/** ------------------------------------------------------------ leaderboard */

function buildLeaderboard(
  dataset: Dataset,
  predictions: ResolvedPrediction[],
): LeaderboardEntry[] {
  const field = buildFieldContext(predictions);
  const byStudent = new Map<string, ResolvedPrediction[]>();
  for (const prediction of predictions) {
    const bucket = byStudent.get(prediction.studentId) ?? [];
    bucket.push(prediction);
    byStudent.set(prediction.studentId, bucket);
  }

  const entries = dataset.students
    .map((student) => {
      const own = byStudent.get(student.id) ?? [];
      const metrics = computeStudentMetrics(student.id, own);
      const scored = calculateLeaderboardScore(metrics, own, field);
      const latest = latestModelFor(dataset, student.id, own);

      return {
        rank: 0,
        previousRank: null as number | null,
        student,
        modelVersion: latest,
        metrics,
        score: metrics.hits * POINTS_PER_HIT,
        components: scored.components as unknown as Record<string, number>,
        provisional: metrics.resolvedPredictions < LEADERBOARD_CONFIG.minResolvedForRanking,
      } satisfies LeaderboardEntry;
    })
    .filter((entry) => entry.metrics.totalPredictions > 0);

  // Ranked students first, provisional ones after. Championship order is
  // points (hits), then hit rate so a 3/3 week beats a 3/12 week.
  entries.sort((a, b) => {
    if (a.provisional !== b.provisional) return a.provisional ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    if (b.metrics.hitRate !== a.metrics.hitRate) return b.metrics.hitRate - a.metrics.hitRate;
    return b.metrics.resolvedPredictions - a.metrics.resolvedPredictions;
  });
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

function latestModelFor(
  dataset: Dataset,
  studentId: string,
  predictions: ResolvedPrediction[],
): ModelVersion | null {
  const used = predictions
    .map((prediction) => prediction.modelVersionId)
    .filter((id, index, all) => all.indexOf(id) === index);

  const candidates = dataset.modelVersions.filter(
    (version) => version.studentId === studentId && (used.length === 0 || used.includes(version.id)),
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

export async function getLeaderboard(filters: LeaderboardFilters = {}): Promise<LeaderboardEntry[]> {
  const dataset = await getDataset();
  const predictions = applyFilters(dataset, allPredictions(dataset), filters);
  const entries = buildLeaderboard(dataset, predictions);

  // Previous rank is the same board computed without the most recent cycle,
  // which is what makes the movement arrows mean "since last Monday".
  const previousCycleIds = new Set(
    dataset.cycles.slice(0, Math.max(dataset.cycles.length - 1, 0)).map((cycle) => cycle.id),
  );
  const previous = buildLeaderboard(
    dataset,
    predictions.filter((prediction) => previousCycleIds.has(prediction.cycleId)),
  );
  const previousRanks = new Map(previous.map((entry) => [entry.student.id, entry.rank]));

  return entries.map((entry) => ({
    ...entry,
    previousRank: previousRanks.get(entry.student.id) ?? null,
  }));
}

export interface PickBoardRow {
  prediction: ResolvedPrediction;
  student: Student;
  cycle: PredictionCycle;
  points: number | null;
}

/**
 * One row per pick, newest cycle first. The public leaderboard is this board,
 * not the blended diagnostic score.
 */
export async function getPickBoard(filters: LeaderboardFilters = {}): Promise<PickBoardRow[]> {
  const dataset = await getDataset();
  const predictions = applyFilters(dataset, allPredictions(dataset), filters);
  const students = new Map(dataset.students.map((student) => [student.id, student]));
  const cycleById = new Map(dataset.cycles.map((cycle) => [cycle.id, cycle]));
  const cycleIndex = new Map(dataset.cycles.map((cycle, index) => [cycle.id, index]));
  const horizonOrder = new Map(HORIZONS.map((horizon, index) => [horizon, index]));

  return predictions
    .map((prediction) => {
      const student = students.get(prediction.studentId);
      const cycle = cycleById.get(prediction.cycleId);
      if (!student || !cycle) return null;
      return {
        prediction,
        student,
        cycle,
        points: pointsForPick(prediction),
      } satisfies PickBoardRow;
    })
    .filter((row): row is PickBoardRow => row !== null)
    .sort((a, b) => {
      const cycleDelta =
        (cycleIndex.get(b.prediction.cycleId) ?? 0) - (cycleIndex.get(a.prediction.cycleId) ?? 0);
      if (cycleDelta !== 0) return cycleDelta;
      const nameDelta = a.student.name.localeCompare(b.student.name);
      if (nameDelta !== 0) return nameDelta;
      const horizonDelta =
        (horizonOrder.get(a.prediction.horizon) ?? 0) - (horizonOrder.get(b.prediction.horizon) ?? 0);
      if (horizonDelta !== 0) return horizonDelta;
      return a.prediction.rank - b.prediction.rank;
    });
}

export interface PickFilterOptions {
  students: Array<{ id: string; name: string }>;
  tickers: string[];
  deadlines: string[];
}

export async function getPickFilterOptions(): Promise<PickFilterOptions> {
  const dataset = await getDataset();
  const deadlines = [
    ...new Set(allPredictions(dataset).map((prediction) => prediction.resolutionDate.slice(0, 10))),
  ].sort((a, b) => b.localeCompare(a));

  return {
    students: [...dataset.students]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((student) => ({ id: student.id, name: student.name })),
    tickers: [...dataset.stocks.map((stock) => stock.ticker)].sort(),
    deadlines,
  };
}

export interface HorizonLeaderboards {
  overall: LeaderboardEntry[];
  byHorizon: Record<Horizon, LeaderboardEntry[]>;
}

export async function getAllHorizonLeaderboards(
  filters: Omit<LeaderboardFilters, "horizon"> = {},
): Promise<HorizonLeaderboards> {
  const overall = await getLeaderboard({ ...filters, horizon: "OVERALL" });
  const byHorizon = {} as Record<Horizon, LeaderboardEntry[]>;
  for (const horizon of HORIZONS) {
    byHorizon[horizon] = await getLeaderboard({ ...filters, horizon });
  }
  return { overall, byHorizon };
}

/** ----------------------------------------------------------- award boards */

export interface Award {
  id: string;
  label: string;
  description: string;
  studentId: string;
  studentName: string;
  value: string;
}

export async function getAwards(): Promise<Award[]> {
  const dataset = await getDataset();
  const board = await getLeaderboard();
  const ranked = board.filter((entry) => !entry.provisional);
  if (ranked.length === 0) return [];

  const pick = (
    id: string,
    label: string,
    description: string,
    sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => number,
    format: (entry: LeaderboardEntry) => string,
  ): Award => {
    const winner = [...ranked].sort(sorter)[0] as LeaderboardEntry;
    return {
      id,
      label,
      description,
      studentId: winner.student.id,
      studentName: winner.student.name,
      value: format(winner),
    };
  };

  const awards: Award[] = [
    pick(
      "best-overall",
      "Best overall",
      "Most championship points (1 per +10% hit)",
      (a, b) => b.score - a.score,
      (entry) => `${entry.score} pts`,
    ),
    pick(
      "best-calibration",
      "Best calibration",
      "Stated probabilities closest to reality",
      (a, b) => a.metrics.brierScore - b.metrics.brierScore,
      (entry) => entry.metrics.brierScore.toFixed(3),
    ),
    pick(
      "highest-return",
      "Highest return",
      "Best average realized return per prediction",
      (a, b) => b.metrics.averageReturn - a.metrics.averageReturn,
      (entry) => formatPercent(entry.metrics.averageReturn),
    ),
    pick(
      "most-consistent",
      "Most consistent",
      "Least erratic week-to-week record",
      (a, b) => b.metrics.consistency - a.metrics.consistency,
      (entry) => `${Math.round(entry.metrics.consistency * 100)}%`,
    ),
    pick(
      "best-hit-rate",
      "Best hit rate",
      "Most predictions that reached +10%",
      (a, b) => b.metrics.hitRate - a.metrics.hitRate,
      (entry) => formatPercent(entry.metrics.hitRate),
    ),
  ];

  const horizonAwards = await Promise.all(
    HORIZONS.map(async (horizon) => {
      const horizonBoard = await getLeaderboard({ horizon });
      const winner = horizonBoard.find((entry) => !entry.provisional);
      if (!winner) return null;
      return {
        id: `best-${horizon.toLowerCase()}`,
        label: `Best ${horizon}`,
        description: `Most points on the ${horizon} horizon`,
        studentId: winner.student.id,
        studentName: winner.student.name,
        value: `${winner.score} pts`,
      } satisfies Award;
    }),
  );

  awards.push(...horizonAwards.filter((award): award is Award => award !== null));

  // "Most improved" compares each student's first research area against their last.
  const improvements = await Promise.all(
    dataset.students.map(async (student) => {
      const evolution = await getModelEvolution(student.id);
      const withData = evolution.filter((row) => row.metrics.resolvedPredictions >= 10);
      if (withData.length < 2) return null;
      const first = withData[0] as (typeof withData)[number];
      const last = withData[withData.length - 1] as (typeof withData)[number];
      return {
        student,
        delta: last.metrics.hitRate - first.metrics.hitRate,
        from: first.area,
        to: last.area,
      };
    }),
  );
  const best = improvements
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.delta - a.delta)[0];

  if (best) {
    awards.push({
      id: "best-improvement",
      label: "Best model improvement",
      description: `Hit rate gained from ${best.from} to ${best.to}`,
      studentId: best.student.id,
      studentName: best.student.name,
      value: `+${(best.delta * 100).toFixed(1)} pts`,
    });
  }

  return awards;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** --------------------------------------------------------------- students */

export async function getStudents(): Promise<Student[]> {
  const dataset = await getDataset();
  return dataset.students;
}

export interface ModelEvolutionRow {
  area: ResearchArea;
  modelVersion: ModelVersion | null;
  metrics: StudentMetrics;
  cycles: number;
}

export async function getModelEvolution(studentId: string): Promise<ModelEvolutionRow[]> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset).filter((p) => p.studentId === studentId);

  return RESEARCH_AREAS.map((area) => {
    const cycleIds = cyclesForArea(dataset, area);
    const slice = predictions.filter((prediction) => cycleIds.has(prediction.cycleId));
    return {
      area,
      modelVersion:
        dataset.modelVersions.find(
          (version) => version.studentId === studentId && version.researchArea === area,
        ) ?? null,
      metrics: computeStudentMetrics(studentId, slice),
      cycles: new Set(slice.map((prediction) => prediction.cycleId)).size,
    };
  }).filter((row) => row.metrics.totalPredictions > 0);
}

export interface StudentDetail {
  student: Student;
  integration: StudentIntegration | null;
  entry: LeaderboardEntry | null;
  bestRank: number | null;
  metrics: StudentMetrics;
  metricsByHorizon: Record<Horizon, StudentMetrics>;
  calibration: CalibrationBin[];
  evolution: ModelEvolutionRow[];
  modelVersions: ModelVersion[];
  predictions: ResolvedPrediction[];
  rankHistory: Array<{ cycleId: string; rank: number; score: number }>;
  cumulative: Array<{ cycleId: string; hitRate: number; averageReturn: number }>;
  diversity: number;
}

export async function getStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const dataset = await getDataset();
  const student = dataset.students.find((entry) => entry.id === studentId);
  if (!student) return null;

  const predictions = allPredictions(dataset)
    .filter((prediction) => prediction.studentId === studentId)
    .sort((a, b) => b.predictionDate.localeCompare(a.predictionDate));

  const board = await getLeaderboard();
  const entry = board.find((row) => row.student.id === studentId) ?? null;

  const metricsByHorizon = {} as Record<Horizon, StudentMetrics>;
  for (const horizon of HORIZONS) {
    metricsByHorizon[horizon] = computeStudentMetrics(
      studentId,
      predictions.filter((prediction) => prediction.horizon === horizon),
    );
  }

  // Rank after each cycle, which is what the ranking-evolution chart plots.
  const rankHistory: Array<{ cycleId: string; rank: number; score: number }> = [];
  const cumulative: Array<{ cycleId: string; hitRate: number; averageReturn: number }> = [];
  const everything = allPredictions(dataset);

  dataset.cycles.forEach((cycle, index) => {
    const upTo = new Set(dataset.cycles.slice(0, index + 1).map((entry) => entry.id));
    const slice = everything.filter((prediction) => upTo.has(prediction.cycleId));
    if (slice.filter((p) => p.result).length === 0) return;

    const board = buildLeaderboard(dataset, slice);
    const row = board.find((item) => item.student.id === studentId);
    if (!row) return;

    rankHistory.push({ cycleId: cycle.id, rank: row.rank, score: row.score });
    cumulative.push({
      cycleId: cycle.id,
      hitRate: row.metrics.hitRate,
      averageReturn: row.metrics.averageReturn,
    });
  });

  return {
    student,
    integration: dataset.integrations.find((row) => row.studentId === studentId) ?? null,
    entry,
    bestRank: rankHistory.length ? Math.min(...rankHistory.map((row) => row.rank)) : null,
    metrics: computeStudentMetrics(studentId, predictions),
    metricsByHorizon,
    calibration: calibrationBins(predictions),
    evolution: await getModelEvolution(studentId),
    modelVersions: dataset.modelVersions.filter((version) => version.studentId === studentId),
    predictions,
    rankHistory,
    cumulative,
    diversity: horizonDiversityScore(
      predictions.filter(
        (prediction) => prediction.cycleId === dataset.cycles[dataset.cycles.length - 1]?.id,
      ),
    ),
  };
}

/** ----------------------------------------------------------------- stocks */

export async function getStocks(): Promise<
  Array<Stock & { latest: StockFeatureRow | null; selections: number; averageProbability: number }>
> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);
  const currentCycle = dataset.cycles[dataset.cycles.length - 1]?.id;

  return dataset.stocks.map((stock) => {
    const rows = dataset.features.filter((row) => row.ticker === stock.ticker);
    const current = predictions.filter(
      (prediction) => prediction.ticker === stock.ticker && prediction.cycleId === currentCycle,
    );
    return {
      ...stock,
      latest: rows[rows.length - 1] ?? null,
      selections: new Set(current.map((prediction) => prediction.studentId)).size,
      averageProbability: mean(current.map((prediction) => prediction.probability)),
    };
  });
}

export interface StockDetail {
  stock: Stock;
  latest: StockFeatureRow | null;
  history: StockFeatureRow[];
  prices: Array<{ date: string; close: number }>;
  predictions: ResolvedPrediction[];
  consensus: ConsensusRow | null;
  timeline: Array<{
    cycleId: string;
    students: number;
    averageProbability: number;
    close: number | null;
  }>;
  peers: Stock[];
}

export async function getStockDetail(ticker: string): Promise<StockDetail | null> {
  const dataset = await getDataset();
  const upper = ticker.toUpperCase();
  const stock = dataset.stocks.find((entry) => entry.ticker === upper);
  if (!stock) return null;

  const history = dataset.features.filter((row) => row.ticker === upper);
  const predictions = allPredictions(dataset)
    .filter((prediction) => prediction.ticker === upper)
    .sort((a, b) => b.predictionDate.localeCompare(a.predictionDate));

  const closeByDate = new Map(
    dataset.prices.filter((row) => row.ticker === upper).map((row) => [row.date, row.close]),
  );

  const timeline = dataset.cycles
    .map((cycle) => {
      const inCycle = predictions.filter((prediction) => prediction.cycleId === cycle.id);
      if (inCycle.length === 0) return null;
      const date = inCycle[0]?.predictionDate ?? cycle.deadlineAt.slice(0, 10);
      return {
        cycleId: cycle.id,
        students: new Set(inCycle.map((prediction) => prediction.studentId)).size,
        averageProbability: mean(inCycle.map((prediction) => prediction.probability)),
        close: closeByDate.get(date) ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const consensusRows = await getConsensus();

  return {
    stock,
    latest: history[history.length - 1] ?? null,
    history,
    prices: dataset.prices
      .filter((row) => row.ticker === upper)
      .map((row) => ({ date: row.date, close: row.close })),
    predictions,
    consensus: consensusRows.find((row) => row.ticker === upper) ?? null,
    timeline,
    peers: dataset.stocks.filter((entry) => stock.peerGroup.includes(entry.ticker)),
  };
}

/** -------------------------------------------------------------- consensus */

export async function getConsensus(cycleId?: string): Promise<ConsensusRow[]> {
  const dataset = await getDataset();
  const target = cycleId ?? dataset.cycles[dataset.cycles.length - 1]?.id;
  const predictions = allPredictions(dataset).filter(
    (prediction) => prediction.cycleId === target,
  );

  return dataset.stocks
    .map((stock) => {
      const own = predictions.filter((prediction) => prediction.ticker === stock.ticker);
      if (own.length === 0) return null;

      const probabilities = own.map((prediction) => prediction.probability);
      const byHorizon = {} as Record<Horizon, number>;
      for (const horizon of HORIZONS) {
        byHorizon[horizon] = own.filter((prediction) => prediction.horizon === horizon).length;
      }

      const resolved = own.filter((prediction) => prediction.result);

      return {
        ticker: stock.ticker,
        stock,
        studentCount: new Set(own.map((prediction) => prediction.studentId)).size,
        predictionCount: own.length,
        averageProbability: mean(probabilities),
        medianProbability: median(probabilities),
        maxProbability: Math.max(...probabilities),
        minProbability: Math.min(...probabilities),
        probabilityStdDev: standardDeviation(probabilities),
        averageExpectedReturn: mean(own.map((prediction) => prediction.expectedReturn)),
        byHorizon,
        resolvedHitRate: resolved.length
          ? resolved.filter((prediction) => prediction.result?.hitTarget).length / resolved.length
          : null,
      } satisfies ConsensusRow;
    })
    .filter((row): row is ConsensusRow => row !== null)
    .sort((a, b) => b.studentCount - a.studentCount || b.averageProbability - a.averageProbability);
}

export interface ConsensusShift {
  ticker: string;
  stock: Stock;
  current: number;
  previous: number;
  delta: number;
}

export async function getConsensusShifts(): Promise<ConsensusShift[]> {
  const dataset = await getDataset();
  const cycles = dataset.cycles;
  if (cycles.length < 2) return [];

  const current = await getConsensus(cycles[cycles.length - 1]?.id);
  const previous = await getConsensus(cycles[cycles.length - 2]?.id);
  const previousByTicker = new Map(previous.map((row) => [row.ticker, row]));

  return current
    .map((row) => {
      const before = previousByTicker.get(row.ticker);
      const previousProbability = before?.averageProbability ?? 0;
      return {
        ticker: row.ticker,
        stock: row.stock,
        current: row.averageProbability,
        previous: previousProbability,
        delta: row.averageProbability - previousProbability,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** ------------------------------------------------------------ predictions */

export interface PredictionDetail {
  prediction: ResolvedPrediction;
  student: Student;
  modelVersion: ModelVersion | null;
  stock: Stock | null;
  cycle: PredictionCycle | null;
  snapshot: PredictionSnapshot | null;
  features: StockFeatureRow | null;
  path: Array<{ date: string; close: number }>;
  peers: ResolvedPrediction[];
}

export async function getPredictionDetail(id: string): Promise<PredictionDetail | null> {
  const dataset = await getDataset();
  const prediction = allPredictions(dataset).find((entry) => entry.id === id);
  if (!prediction) return null;

  const student = dataset.students.find((entry) => entry.id === prediction.studentId);
  if (!student) return null;

  const endDate =
    prediction.status === "resolved" ? prediction.resolutionDate : dataset.anchorDate;

  return {
    prediction,
    student,
    modelVersion:
      dataset.modelVersions.find((version) => version.id === prediction.modelVersionId) ?? null,
    stock: dataset.stocks.find((entry) => entry.ticker === prediction.ticker) ?? null,
    cycle: dataset.cycles.find((cycle) => cycle.id === prediction.cycleId) ?? null,
    snapshot: dataset.snapshots.find((snapshot) => snapshot.id === prediction.snapshotId) ?? null,
    features:
      dataset.features.find(
        (row) => row.ticker === prediction.ticker && row.snapshotDate === prediction.predictionDate,
      ) ?? null,
    path: dataset.prices
      .filter(
        (row) =>
          row.ticker === prediction.ticker &&
          row.date >= prediction.predictionDate &&
          row.date <= endDate,
      )
      .map((row) => ({ date: row.date, close: row.close })),
    peers: allPredictions(dataset).filter(
      (entry) =>
        entry.ticker === prediction.ticker &&
        entry.cycleId === prediction.cycleId &&
        entry.horizon === prediction.horizon &&
        entry.id !== prediction.id,
    ),
  };
}

/** ----------------------------------------------------------------- cycles */

export interface CycleSummary {
  cycle: PredictionCycle;
  area: ResearchArea;
  students: number;
  predictions: number;
  resolved: number;
  hitRate: number | null;
  averageReturn: number | null;
  winner: { studentId: string; name: string; hitRate: number; hits: number } | null;
}

export async function getCycleSummaries(): Promise<CycleSummary[]> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);

  return dataset.cycles
    .map((cycle, index) => {
      const inCycle = predictions.filter((prediction) => prediction.cycleId === cycle.id);
      const resolved = inCycle.filter((prediction) => prediction.result);

      const byStudent = new Map<string, ResolvedPrediction[]>();
      for (const prediction of resolved) {
        const bucket = byStudent.get(prediction.studentId) ?? [];
        bucket.push(prediction);
        byStudent.set(prediction.studentId, bucket);
      }

      const ranked = [...byStudent.entries()]
        .map(([studentId, bucket]) => ({
          studentId,
          name: dataset.students.find((student) => student.id === studentId)?.name ?? studentId,
          hits: bucket.filter((prediction) => prediction.result?.hitTarget).length,
          hitRate: bucket.filter((prediction) => prediction.result?.hitTarget).length / bucket.length,
        }))
        .sort((a, b) => b.hits - a.hits || b.hitRate - a.hitRate);

      return {
        cycle,
        area: researchAreaForCycle(index, dataset.cycles.length),
        students: new Set(inCycle.map((prediction) => prediction.studentId)).size,
        predictions: inCycle.length,
        resolved: resolved.length,
        hitRate: resolved.length
          ? resolved.filter((prediction) => prediction.result?.hitTarget).length / resolved.length
          : null,
        averageReturn: resolved.length
          ? mean(resolved.map((prediction) => prediction.result?.realizedReturn ?? 0))
          : null,
        winner: ranked[0] ?? null,
      };
    })
    .reverse();
}

export interface WeeklyPodiumEntry {
  rank: number;
  student: Student;
  hits: number;
  resolved: number;
  hitRate: number;
  averageReturn: number;
}

/** The most recent cycle that has enough resolved predictions to crown anyone. */
export async function getWeeklyPodium(): Promise<{
  cycle: PredictionCycle;
  podium: WeeklyPodiumEntry[];
} | null> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);

  for (let index = dataset.cycles.length - 1; index >= 0; index -= 1) {
    const cycle = dataset.cycles[index] as PredictionCycle;
    const resolved = predictions.filter(
      (prediction) => prediction.cycleId === cycle.id && prediction.result,
    );
    if (resolved.length < 20) continue;

    const byStudent = new Map<string, ResolvedPrediction[]>();
    for (const prediction of resolved) {
      const bucket = byStudent.get(prediction.studentId) ?? [];
      bucket.push(prediction);
      byStudent.set(prediction.studentId, bucket);
    }

    const podium = [...byStudent.entries()]
      .map(([studentId, bucket]) => {
        const student = dataset.students.find((entry) => entry.id === studentId) as Student;
        const hits = bucket.filter((prediction) => prediction.result?.hitTarget).length;
        return {
          rank: 0,
          student,
          hits,
          resolved: bucket.length,
          hitRate: hits / bucket.length,
          averageReturn: mean(bucket.map((prediction) => prediction.result?.realizedReturn ?? 0)),
        };
      })
      .sort((a, b) => b.hits - a.hits || b.averageReturn - a.averageReturn)
      .slice(0, 3)
      .map((entry, position) => ({ ...entry, rank: position + 1 }));

    return { cycle, podium };
  }

  return null;
}

/** ----------------------------------------------------------- integrations */

export async function getIntegrations(): Promise<
  Array<StudentIntegration & { student: Student | null }>
> {
  const dataset = await getDataset();
  return dataset.integrations.map((integration) => ({
    ...integration,
    student: dataset.students.find((student) => student.id === integration.studentId) ?? null,
  }));
}

export async function getSnapshot(
  studentId: string,
  cycleId: string,
): Promise<PredictionSnapshot | null> {
  const dataset = await getDataset();
  return (
    dataset.snapshots.find(
      (snapshot) => snapshot.studentId === studentId && snapshot.cycleId === cycleId,
    ) ?? null
  );
}

/** --------------------------------------------------------------- insights */

export interface Insight {
  id: string;
  text: string;
  tone: "positive" | "neutral" | "negative";
}

/**
 * Rule-based observations for the home page and the admin dashboard.
 *
 * Deliberately not an LLM: every sentence here is a number the platform already
 * computed, and a wrong-but-fluent sentence about a student's performance is
 * worse than no sentence.
 */
export async function getInsights(): Promise<Insight[]> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);
  const insights: Insight[] = [];

  // Research area comparison — the central question of the course.
  const areaStats = RESEARCH_AREAS.map((area) => {
    const cycleIds = cyclesForArea(dataset, area);
    const resolved = predictions.filter(
      (prediction) => cycleIds.has(prediction.cycleId) && prediction.result,
    );
    return {
      area,
      resolved: resolved.length,
      hitRate: resolved.length
        ? resolved.filter((prediction) => prediction.result?.hitTarget).length / resolved.length
        : 0,
    };
  }).filter((row) => row.resolved >= 50);

  if (areaStats.length >= 2) {
    const first = areaStats[0] as (typeof areaStats)[number];
    const last = areaStats[areaStats.length - 1] as (typeof areaStats)[number];
    const delta = (last.hitRate - first.hitRate) * 100;
    insights.push({
      id: "area-comparison",
      tone: delta >= 0 ? "positive" : "negative",
      text:
        delta >= 0
          ? `${last.area} models are outperforming ${first.area} models by ${delta.toFixed(1)} points of hit rate.`
          : `${last.area} models are trailing ${first.area} models by ${Math.abs(delta).toFixed(1)} points of hit rate — more complexity has not paid off yet.`,
    });
  }

  // Which horizon the cohort actually reads best.
  const horizonStats = HORIZONS.map((horizon) => {
    const resolved = predictions.filter(
      (prediction) => prediction.horizon === horizon && prediction.result,
    );
    return {
      horizon,
      resolved: resolved.length,
      hitRate: resolved.length
        ? resolved.filter((prediction) => prediction.result?.hitTarget).length / resolved.length
        : 0,
    };
  }).filter((row) => row.resolved > 0);

  const bestHorizon = [...horizonStats].sort((a, b) => b.hitRate - a.hitRate)[0];
  if (bestHorizon) {
    insights.push({
      id: "best-horizon",
      tone: "neutral",
      text: `The cohort reaches +10% most often on the ${bestHorizon.horizon} horizon (${(bestHorizon.hitRate * 100).toFixed(1)}% of ${bestHorizon.resolved} resolved predictions).`,
    });
  }

  // Consensus pick of the week.
  const consensus = await getConsensus();
  const top = consensus[0];
  if (top) {
    insights.push({
      id: "consensus",
      tone: "neutral",
      text: `${top.ticker} is this cycle's highest-consensus pick — ${top.studentCount} of ${dataset.students.length} students selected it at an average ${(top.averageProbability * 100).toFixed(0)}% probability.`,
    });
  }

  // Most divided opinion.
  const controversial = [...consensus]
    .filter((row) => row.predictionCount >= 4)
    .sort((a, b) => b.probabilityStdDev - a.probabilityStdDev)[0];
  if (controversial) {
    insights.push({
      id: "controversial",
      tone: "neutral",
      text: `${controversial.ticker} splits the room: probabilities range from ${(controversial.minProbability * 100).toFixed(0)}% to ${(controversial.maxProbability * 100).toFixed(0)}%.`,
    });
  }

  // Biggest individual model improvement.
  const awards = await getAwards();
  const improvement = awards.find((award) => award.id === "best-improvement");
  if (improvement) {
    insights.push({
      id: "improvement",
      tone: "positive",
      text: `${improvement.studentName} shows the largest model improvement of the course: ${improvement.value} of hit rate.`,
    });
  }

  // Calibration warning, which is the lesson most students learn the hard way.
  const board = await getLeaderboard();
  const overconfident = board
    .filter((entry) => !entry.provisional)
    .filter((entry) => entry.metrics.averageProbability > entry.metrics.hitRate + 0.12)
    .sort(
      (a, b) =>
        b.metrics.averageProbability -
        b.metrics.hitRate -
        (a.metrics.averageProbability - a.metrics.hitRate),
    )[0];
  if (overconfident) {
    insights.push({
      id: "overconfidence",
      tone: "negative",
      text: `${overconfident.student.name} states an average ${(overconfident.metrics.averageProbability * 100).toFixed(0)}% probability but hits ${(overconfident.metrics.hitRate * 100).toFixed(0)}% of the time — the widest confidence gap in the cohort.`,
    });
  }

  return insights;
}

/** Cohort-wide calibration, used by the methodology panel. */
export async function getCohortCalibration(): Promise<{
  bins: CalibrationBin[];
  field: FieldContext;
}> {
  const dataset = await getDataset();
  const predictions = allPredictions(dataset);
  return { bins: calibrationBins(predictions), field: buildFieldContext(predictions) };
}

export async function getCycles(): Promise<PredictionCycle[]> {
  const dataset = await getDataset();
  return [...dataset.cycles].reverse();
}
