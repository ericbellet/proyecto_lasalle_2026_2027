import { db, schema } from "@/db";
import { mockDataset } from "@/lib/mock/dataset";

/**
 * Loads the deterministic mock season into PostgreSQL.
 *
 * Safe to re-run: it wipes the competition tables first, then inserts in
 * foreign-key order. Use this after `npm run db:migrate` when you want the
 * live database to look identical to MOCK_MODE.
 */

const BATCH = 500;

async function insertBatches<T>(
  table: Parameters<ReturnType<typeof db>["insert"]>[0],
  rows: T[],
): Promise<void> {
  const client = db();
  for (let start = 0; start < rows.length; start += BATCH) {
    const slice = rows.slice(start, start + BATCH);
    if (slice.length === 0) continue;
    await client.insert(table).values(slice as never);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed. MOCK_MODE does not need a database.");
  }

  const dataset = mockDataset();
  const client = db();

  console.log(`Seeding ${dataset.students.length} students, ${dataset.cycles.length} cycles…`);

  await client.delete(schema.auditLogs);
  await client.delete(schema.weeklyWinners);
  await client.delete(schema.leaderboardSnapshots);
  await client.delete(schema.predictionResults);
  await client.delete(schema.predictions);
  await client.delete(schema.predictionSnapshots);
  await client.delete(schema.stockFeatures);
  await client.delete(schema.marketPrices);
  await client.delete(schema.benchmarkPrices);
  await client.delete(schema.modelVersions);
  await client.delete(schema.studentIntegrations);
  await client.delete(schema.predictionCycles);
  await client.delete(schema.stocks);
  await client.delete(schema.students);

  await insertBatches(
    schema.students,
    dataset.students.map((student) => ({
      id: student.id,
      name: student.name,
      handle: student.handle,
      avatarSeed: student.avatarSeed,
      joinedAt: new Date(student.joinedAt),
    })),
  );

  await insertBatches(
    schema.studentIntegrations,
    dataset.integrations.map((row) => ({
      studentId: row.studentId,
      baseUrl: row.baseUrl,
      predictionsEndpoint: row.predictionsEndpoint,
      healthEndpoint: row.healthEndpoint,
      apiKeyEnvVar: row.apiKeyEnvVar,
      enabled: row.enabled,
      lastFetchAt: row.lastFetchAt ? new Date(row.lastFetchAt) : null,
      lastStatus: row.lastStatus,
      lastError: row.lastError,
      lastLatencyMs: row.lastLatencyMs,
    })),
  );

  await insertBatches(
    schema.stocks,
    dataset.stocks.map((stock) => ({
      ticker: stock.ticker,
      companyName: stock.companyName,
      sector: stock.sector,
      industry: stock.industry,
      country: stock.country,
      marketCap: stock.marketCap,
      employees: stock.employees,
      peerGroup: stock.peerGroup,
    })),
  );

  await insertBatches(
    schema.modelVersions,
    dataset.modelVersions.map((version) => ({
      id: version.id,
      studentId: version.studentId,
      version: version.version,
      name: version.name,
      researchArea: version.researchArea,
      approach: version.approach,
      createdAt: new Date(version.createdAt),
      retiredAt: version.retiredAt ? new Date(version.retiredAt) : null,
    })),
  );

  await insertBatches(
    schema.predictionCycles,
    dataset.cycles.map((cycle) => ({
      id: cycle.id,
      label: cycle.label,
      weekNumber: cycle.weekNumber,
      year: cycle.year,
      opensAt: new Date(cycle.opensAt),
      deadlineAt: new Date(cycle.deadlineAt),
      lockedAt: cycle.lockedAt ? new Date(cycle.lockedAt) : null,
      status: cycle.status,
    })),
  );

  await insertBatches(
    schema.predictionSnapshots,
    dataset.snapshots.map((snapshot) => ({
      id: snapshot.id,
      studentId: snapshot.studentId,
      cycleId: snapshot.cycleId,
      modelVersionId: snapshot.modelVersionId || null,
      rawPayload: snapshot.rawPayload as never,
      payloadHash: snapshot.payloadHash,
      fetchedAt: new Date(snapshot.fetchedAt),
      lockedAt: snapshot.lockedAt ? new Date(snapshot.lockedAt) : null,
    })),
  );

  await insertBatches(
    schema.predictions,
    dataset.predictions.map((prediction) => ({
      id: prediction.id,
      snapshotId: prediction.snapshotId,
      studentId: prediction.studentId,
      cycleId: prediction.cycleId,
      modelVersionId: prediction.modelVersionId || null,
      ticker: prediction.ticker,
      horizon: prediction.horizon,
      rank: prediction.rank,
      probability: prediction.probability,
      expectedReturn: prediction.expectedReturn,
      targetPrice: prediction.targetPrice,
      investmentThesis: prediction.investmentThesis,
      risks: prediction.risks,
      predictionDate: prediction.predictionDate,
      resolutionDate: prediction.resolutionDate,
      status: prediction.status,
    })),
  );

  await insertBatches(
    schema.predictionResults,
    dataset.results.map((result) => ({
      predictionId: result.predictionId,
      predictionPrice: result.predictionPrice,
      resolutionPrice: result.resolutionPrice,
      realizedReturn: result.realizedReturn,
      benchmarkReturn: result.benchmarkReturn,
      alpha: result.alpha,
      hitTarget: result.hitTarget,
      resolvedAt: new Date(result.resolvedAt),
    })),
  );

  await insertBatches(
    schema.marketPrices,
    dataset.prices.map((price) => ({
      ticker: price.ticker,
      date: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      adjustedClose: price.adjustedClose,
      volume: price.volume,
    })),
  );

  await insertBatches(
    schema.benchmarkPrices,
    dataset.benchmark.map((row) => ({ date: row.date, close: row.close })),
  );

  await insertBatches(
    schema.stockFeatures,
    dataset.features.map((row) => ({
      ticker: row.ticker,
      snapshotDate: row.snapshotDate,
      payload: row as never,
      baselineInvestmentScore: row.baselineInvestmentScore,
    })),
  );

  console.log(
    `Seeded ${dataset.predictions.length} predictions (${dataset.results.length} resolved).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
