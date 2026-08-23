/**
 * Prints a summary of the generated dataset. Useful as a sanity check after
 * changing the generator: run `npx tsx scripts/dataset-stats.ts`.
 */
import { HORIZONS } from "../src/config/challenge";
import { generateMockDataset } from "../src/lib/mock/dataset";
import {
  brierScore,
  buildFieldContext,
  calculateLeaderboardScore,
  computeStudentMetrics,
  mean,
} from "../src/lib/metrics";
import type { ResolvedPrediction } from "../src/lib/types";

const started = Date.now();
const dataset = generateMockDataset();
const elapsed = Date.now() - started;

const resultsById = new Map(dataset.results.map((result) => [result.predictionId, result]));
const joined: ResolvedPrediction[] = dataset.predictions.map((prediction) => ({
  ...prediction,
  result: resultsById.get(prediction.id) ?? null,
}));

console.log(`generated in ${elapsed}ms · seed=${dataset.seed} · anchor=${dataset.anchorDate}`);
console.log({
  stocks: dataset.stocks.length,
  priceRows: dataset.prices.length,
  featureRows: dataset.features.length,
  students: dataset.students.length,
  modelVersions: dataset.modelVersions.length,
  cycles: dataset.cycles.length,
  snapshots: dataset.snapshots.length,
  predictions: dataset.predictions.length,
  resolved: dataset.results.length,
  active: dataset.predictions.length - dataset.results.length,
});

console.log("\nHit rate and Brier by horizon");
for (const horizon of HORIZONS) {
  const slice = joined.filter((p) => p.horizon === horizon && p.result);
  const hits = slice.filter((p) => p.result?.hitTarget).length;
  console.log(
    `  ${horizon.padEnd(3)} resolved=${String(slice.length).padStart(5)} hitRate=${(
      (hits / Math.max(slice.length, 1)) * 100
    ).toFixed(1)}% avgProb=${(mean(slice.map((p) => p.probability)) * 100).toFixed(1)}% brier=${brierScore(
      slice,
    ).toFixed(4)}`,
  );
}

const field = buildFieldContext(joined);
const table = dataset.students
  .map((student) => {
    const own = joined.filter((p) => p.studentId === student.id);
    const metrics = computeStudentMetrics(student.id, own);
    const scored = calculateLeaderboardScore(metrics, own, field);
    return { student, metrics, ...scored };
  })
  .sort((a, b) => b.score - a.score);

console.log(
  `\nField: hitRate=${(field.averageHitRate * 100).toFixed(1)}% alpha=${(field.averageAlpha * 100).toFixed(
    2,
  )}% alphaSd=${(field.alphaStdDev * 100).toFixed(2)}%`,
);
console.log("\nLeaderboard");
console.log("  # name                    n   hit%   avgRet   alpha    brier    BSS   cons   score");
table.forEach((row, index) => {
  const m = row.metrics;
  console.log(
    `  ${String(index + 1).padStart(2)} ${row.student.name.padEnd(18)} ${String(m.resolvedPredictions).padStart(
      4,
    )}  ${(m.hitRate * 100).toFixed(1).padStart(5)}  ${(m.averageReturn * 100).toFixed(2).padStart(6)}%  ${(
      m.averageAlpha * 100
    )
      .toFixed(2)
      .padStart(6)}%  ${m.brierScore.toFixed(4)}  ${row.brierSkillScore.toFixed(3).padStart(6)}  ${m.consistency.toFixed(
      2,
    )}  ${row.score.toFixed(1).padStart(5)}`,
  );
});

const sample = dataset.features.filter((row) => row.ticker === "NVDA").slice(-1)[0];
console.log("\nSample feature row (NVDA, last cycle)");
console.log({
  snapshotDate: sample?.snapshotDate,
  close: sample?.close,
  peRatio: sample?.peRatio,
  revenueGrowthYoy: sample?.revenueGrowthYoy,
  momentum3m: sample?.momentum3m,
  volatility30d: sample?.volatility30d,
  growthScore: sample?.growthScore,
  valuationScore: sample?.valuationScore,
  baselineInvestmentScore: sample?.baselineInvestmentScore,
});
