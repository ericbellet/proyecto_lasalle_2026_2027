import { asc } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Dataset } from "@/lib/data/dataset";
import type {
  IntegrationStatus,
  CycleStatus,
  PredictionStatus,
  StockFeatureRow,
} from "@/lib/types";
import type { Horizon, ResearchArea } from "@/config/challenge";

/**
 * Loads the whole season into the same in-memory shape the mock generator
 * produces, so every query and every metric runs identical code in both modes.
 *
 * This is a deliberate trade-off. A season is roughly 7,000 predictions and
 * 5,000 price rows; pulling them in one round trip and aggregating in
 * TypeScript is well under a second, keeps the scoring logic in one testable
 * place, and spares the codebase twenty hand-tuned SQL aggregates that students
 * would have to read. If the platform ever holds several years of cohorts, this
 * is the function to replace with real SQL — nothing else changes.
 */
export async function loadDatasetFromDb(): Promise<Dataset> {
  const client = db();

  // Sequential on purpose: the Supabase transaction pooler (6543) plus a
  // single serverless connection deadlocks if these run in Promise.all.
  const studentRows = await client.select().from(schema.students).orderBy(asc(schema.students.id));
  const integrationRows = await client.select().from(schema.studentIntegrations);
  const modelRows = await client
    .select()
    .from(schema.modelVersions)
    .orderBy(asc(schema.modelVersions.id));
  const cycleRows = await client
    .select()
    .from(schema.predictionCycles)
    .orderBy(asc(schema.predictionCycles.deadlineAt));
  const snapshotRows = await client.select().from(schema.predictionSnapshots);
  const predictionRows = await client
    .select()
    .from(schema.predictions)
    .orderBy(asc(schema.predictions.id));
  const resultRows = await client.select().from(schema.predictionResults);
  const stockRows = await client.select().from(schema.stocks).orderBy(asc(schema.stocks.ticker));
  const priceRows = await client
    .select()
    .from(schema.marketPrices)
    .orderBy(asc(schema.marketPrices.date));
  const benchmarkRows = await client
    .select()
    .from(schema.benchmarkPrices)
    .orderBy(asc(schema.benchmarkPrices.date));
  const featureRows = await client
    .select()
    .from(schema.stockFeatures)
    .orderBy(asc(schema.stockFeatures.snapshotDate));

  const iso = (value: Date | null) => (value ? value.toISOString() : null);
  const anchorDate =
    priceRows[priceRows.length - 1]?.date ?? new Date().toISOString().slice(0, 10);

  return {
    seed: "database",
    anchorDate,
    generatedAt: new Date().toISOString(),

    students: studentRows.map((row) => ({
      id: row.id,
      name: row.name,
      handle: row.handle,
      avatarSeed: row.avatarSeed,
      kind: row.kind === "influencer" ? "influencer" : "student",
      joinedAt: row.joinedAt.toISOString(),
    })),

    integrations: integrationRows.map((row) => ({
      studentId: row.studentId,
      baseUrl: row.baseUrl,
      predictionsEndpoint: row.predictionsEndpoint,
      healthEndpoint: row.healthEndpoint,
      apiKeyEnvVar: row.apiKeyEnvVar,
      enabled: row.enabled,
      lastFetchAt: iso(row.lastFetchAt),
      lastStatus: row.lastStatus as IntegrationStatus,
      lastError: row.lastError,
      lastLatencyMs: row.lastLatencyMs,
    })),

    modelVersions: modelRows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      version: row.version,
      name: row.name,
      researchArea: row.researchArea as ResearchArea,
      approach: row.approach,
      createdAt: row.createdAt.toISOString(),
      retiredAt: iso(row.retiredAt),
    })),

    cycles: cycleRows.map((row) => ({
      id: row.id,
      label: row.label,
      weekNumber: row.weekNumber,
      year: row.year,
      opensAt: row.opensAt.toISOString(),
      deadlineAt: row.deadlineAt.toISOString(),
      lockedAt: iso(row.lockedAt),
      status: row.status as CycleStatus,
    })),

    snapshots: snapshotRows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      cycleId: row.cycleId,
      modelVersionId: row.modelVersionId ?? "",
      rawPayload: row.rawPayload,
      payloadHash: row.payloadHash,
      fetchedAt: row.fetchedAt.toISOString(),
      lockedAt: iso(row.lockedAt),
    })),

    predictions: predictionRows.map((row) => ({
      id: row.id,
      snapshotId: row.snapshotId,
      studentId: row.studentId,
      cycleId: row.cycleId,
      modelVersionId: row.modelVersionId ?? "",
      ticker: row.ticker,
      horizon: row.horizon as Horizon,
      rank: row.rank,
      probability: row.probability,
      expectedReturn: row.expectedReturn,
      targetPrice: row.targetPrice,
      investmentThesis: row.investmentThesis,
      risks: row.risks,
      sourceUrl: row.sourceUrl,
      predictionDate: row.predictionDate,
      resolutionDate: row.resolutionDate,
      status: row.status as PredictionStatus,
    })),

    results: resultRows.map((row) => ({
      predictionId: row.predictionId,
      predictionPrice: row.predictionPrice,
      resolutionPrice: row.resolutionPrice,
      realizedReturn: row.realizedReturn,
      benchmarkReturn: row.benchmarkReturn,
      alpha: row.alpha,
      hitTarget: row.hitTarget,
      resolvedAt: row.resolvedAt.toISOString(),
    })),

    stocks: stockRows.map((row) => ({
      ticker: row.ticker,
      companyName: row.companyName,
      sector: row.sector,
      industry: row.industry,
      country: row.country,
      marketCap: row.marketCap,
      employees: row.employees,
      peerGroup: row.peerGroup,
    })),

    prices: priceRows.map((row) => ({
      ticker: row.ticker,
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      adjustedClose: row.adjustedClose,
      volume: row.volume,
    })),

    benchmark: benchmarkRows.map((row) => ({ date: row.date, close: row.close })),

    features: featureRows.map((row) => row.payload as StockFeatureRow),
  };
}
