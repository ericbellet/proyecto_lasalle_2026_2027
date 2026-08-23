import "server-only";

import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { HORIZONS, type Horizon } from "@/config/challenge";
import { STUDENTS, studentConfig, type StudentConfig } from "@/config/students";
import { calculateResolutionDate, cycleIdFor, isoWeek, startOfIsoWeek, toIsoDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { marketDataProvider } from "@/lib/market-data";
import { buildFieldContext, calculateLeaderboardScore, computeStudentMetrics } from "@/lib/metrics";
import { calculatePredictionOutcome } from "@/lib/predictions/outcome";
import { fetchAllStudents, fetchStudent, type FetchOutcome } from "@/lib/student-api/fetcher";
import {
  assertSnapshotMutable,
  ImmutableSnapshotError,
} from "@/lib/student-api/immutability";
import type { ResolvedPrediction } from "@/lib/types";

/**
 * The professor's write path.
 *
 * Every operation here mutates the central database, so each one starts with
 * `requireDatabase()`. In mock mode the whole platform is a deterministic
 * fixture and there is nothing to write to — failing loudly is better than
 * pretending a cycle was locked.
 */

export class MockModeError extends Error {
  constructor(operation: string) {
    super(
      `${operation} needs a database. The platform is running in mock mode; set DATABASE_URL and MOCK_MODE=false to enable write operations.`,
    );
    this.name = "MockModeError";
  }
}

export { ImmutableSnapshotError };

function requireDatabase(operation: string) {
  if (env.mockMode) throw new MockModeError(operation);
  return db();
}

async function audit(
  action: string,
  entityType: string,
  entityId: string,
  detail?: unknown,
): Promise<void> {
  await db()
    .insert(schema.auditLogs)
    .values({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      entityType,
      entityId,
      actor: "admin",
      detail: (detail ?? null) as never,
    });
}

/** ------------------------------------------------------------------ cycles */

export async function createCycle(dateInput?: string): Promise<{ id: string; created: boolean }> {
  const client = requireDatabase("Creating a cycle");

  const reference = dateInput ? new Date(`${dateInput}T00:00:00.000Z`) : new Date();
  const monday = startOfIsoWeek(reference);
  const id = cycleIdFor(monday);
  const { year, week } = isoWeek(monday);

  // The deadline is Monday 09:00 UTC: predictions must be in before the US
  // session opens, otherwise a student could submit knowing the day's move.
  const deadline = new Date(monday);
  deadline.setUTCHours(9, 0, 0, 0);

  const existing = await client
    .select({ id: schema.predictionCycles.id })
    .from(schema.predictionCycles)
    .where(eq(schema.predictionCycles.id, id));

  if (existing.length > 0) return { id, created: false };

  await client.insert(schema.predictionCycles).values({
    id,
    label: `Week ${week}, ${year}`,
    weekNumber: week,
    year,
    opensAt: monday,
    deadlineAt: deadline,
    status: "open",
  });
  await audit("cycle.create", "prediction_cycle", id);

  return { id, created: true };
}

export async function lockCycle(cycleId: string): Promise<{ snapshots: number }> {
  const client = requireDatabase("Locking a cycle");
  const now = new Date();

  // Only unlocked snapshots are touched, so re-running lock is a no-op rather
  // than a way to rewrite an earlier lock timestamp.
  const locked = await client
    .update(schema.predictionSnapshots)
    .set({ lockedAt: now })
    .where(
      and(
        eq(schema.predictionSnapshots.cycleId, cycleId),
        isNull(schema.predictionSnapshots.lockedAt),
      ),
    )
    .returning({ id: schema.predictionSnapshots.id });

  await client
    .update(schema.predictionCycles)
    .set({ lockedAt: now, status: "locked" })
    .where(eq(schema.predictionCycles.id, cycleId));

  await audit("cycle.lock", "prediction_cycle", cycleId, { snapshots: locked.length });
  return { snapshots: locked.length };
}

/** ------------------------------------------------------- fetch + snapshot */

export interface StoreResult extends FetchOutcome {
  stored: boolean;
  predictionsStored: number;
  storeError: string | null;
}

/**
 * Fetches one student and, when the payload is valid, records it.
 *
 * The snapshot is written before the normalised predictions and both happen in
 * one transaction: a half-recorded cycle is worse than a failed one.
 */
export async function fetchAndStore(
  student: StudentConfig,
  cycleId: string,
): Promise<StoreResult> {
  const client = requireDatabase("Fetching a student");
  const outcome = await fetchStudent(student);

  await client
    .update(schema.studentIntegrations)
    .set({
      lastFetchAt: new Date(outcome.fetchedAt),
      lastStatus: outcome.status,
      lastError: outcome.error,
      lastLatencyMs: outcome.latencyMs,
    })
    .where(eq(schema.studentIntegrations.studentId, student.id));

  if (!outcome.payload || !outcome.payloadHash) {
    return { ...outcome, stored: false, predictionsStored: 0, storeError: outcome.error };
  }

  const existing = await client
    .select({ lockedAt: schema.predictionSnapshots.lockedAt })
    .from(schema.predictionSnapshots)
    .where(
      and(
        eq(schema.predictionSnapshots.studentId, student.id),
        eq(schema.predictionSnapshots.cycleId, cycleId),
      ),
    );

  try {
    assertSnapshotMutable(existing[0]?.lockedAt ?? null, student.id, cycleId);
  } catch (error) {
    return {
      ...outcome,
      stored: false,
      predictionsStored: 0,
      storeError: error instanceof Error ? error.message : String(error),
    };
  }

  const snapshotId = `snap-${cycleId}-${student.id}`;
  const predictionDate = toIsoDate(new Date());
  const payload = outcome.payload;

  const modelVersionId = await ensureModelVersion(student.id, payload.model_version, payload.model_name ?? null);

  await client.transaction(async (tx) => {
    await tx
      .insert(schema.predictionSnapshots)
      .values({
        id: snapshotId,
        studentId: student.id,
        cycleId,
        modelVersionId,
        rawPayload: outcome.rawBody as never,
        payloadHash: outcome.payloadHash as string,
        fetchedAt: new Date(outcome.fetchedAt),
      })
      .onConflictDoUpdate({
        target: [schema.predictionSnapshots.studentId, schema.predictionSnapshots.cycleId],
        set: {
          rawPayload: outcome.rawBody as never,
          payloadHash: outcome.payloadHash as string,
          fetchedAt: new Date(outcome.fetchedAt),
          modelVersionId,
        },
      });

    // Replacing an unlocked snapshot replaces its predictions too, otherwise a
    // re-fetch that drops a ticker would leave the old pick behind.
    await tx.delete(schema.predictions).where(eq(schema.predictions.snapshotId, snapshotId));

    await tx.insert(schema.predictions).values(
      payload.predictions.map((item) => ({
        id: `pred-${cycleId}-${student.id}-${item.horizon}-${item.rank}`,
        snapshotId,
        studentId: student.id,
        cycleId,
        modelVersionId,
        ticker: item.ticker,
        horizon: item.horizon,
        rank: item.rank,
        probability: item.probability,
        expectedReturn: item.expected_return,
        targetPrice: item.target_price ?? null,
        investmentThesis: item.investment_thesis ?? null,
        risks: item.risks ?? null,
        predictionDate,
        resolutionDate: toIsoDate(calculateResolutionDate(predictionDate, item.horizon as Horizon)),
        status: "active" as const,
      })),
    );
  });

  await audit("snapshot.store", "prediction_snapshot", snapshotId, {
    predictions: payload.predictions.length,
    hash: outcome.payloadHash,
  });

  return {
    ...outcome,
    stored: true,
    predictionsStored: payload.predictions.length,
    storeError: null,
  };
}

export async function fetchAllAndStore(cycleId: string): Promise<StoreResult[]> {
  requireDatabase("Fetching all students");

  const enabled = STUDENTS.filter((student) => student.enabled);
  const results: StoreResult[] = [];

  // `fetchAllStudents` already bounds concurrency on the network side; the
  // writes are then sequential so one slow transaction cannot exhaust the pool.
  const outcomes = await fetchAllStudents(enabled);
  for (const outcome of outcomes) {
    const student = studentConfig(outcome.studentId);
    if (!student) continue;
    results.push(await fetchAndStore(student, cycleId));
  }

  await audit("cycle.fetch_all", "prediction_cycle", cycleId, {
    attempted: enabled.length,
    stored: results.filter((result) => result.stored).length,
  });

  return results;
}

async function ensureModelVersion(
  studentId: string,
  version: string,
  name: string | null,
): Promise<string> {
  const client = db();
  const id = `${studentId}-${version}`;

  await client
    .insert(schema.modelVersions)
    .values({
      id,
      studentId,
      version,
      name: name ?? version,
      researchArea: "RA1",
      approach: "",
    })
    .onConflictDoNothing({ target: schema.modelVersions.id });

  return id;
}

/** -------------------------------------------------------------- resolution */

export interface ResolveSummary {
  checked: number;
  resolved: number;
  hits: number;
  failures: Array<{ predictionId: string; reason: string }>;
}

/**
 * Prices every prediction whose resolution date has passed.
 *
 * A hit is the *closing* return reaching the target, not the intraday high: the
 * students are predicting a holdable outcome, and a wick through the target that
 * closes back down is not one.
 */
export async function resolveDuePredictions(asOf = new Date()): Promise<ResolveSummary> {
  const client = requireDatabase("Resolving predictions");
  const provider = marketDataProvider();
  const today = toIsoDate(asOf);

  const due = await client
    .select()
    .from(schema.predictions)
    .where(
      and(
        eq(schema.predictions.status, "active"),
        lte(schema.predictions.resolutionDate, today),
      ),
    );

  const summary: ResolveSummary = { checked: due.length, resolved: 0, hits: 0, failures: [] };

  for (const prediction of due) {
    try {
      const [entry, exit] = await Promise.all([
        provider.getPrice(prediction.ticker, new Date(prediction.predictionDate)),
        provider.getPrice(prediction.ticker, new Date(prediction.resolutionDate)),
      ]);

      if (!entry || !exit) {
        summary.failures.push({
          predictionId: prediction.id,
          reason: "Market data provider returned no price for one of the two dates",
        });
        continue;
      }

      const benchmarkReturn = await benchmarkOver(
        prediction.predictionDate,
        prediction.resolutionDate,
      );
      const outcome = calculatePredictionOutcome(entry, exit, benchmarkReturn);

      await client.transaction(async (tx) => {
        await tx
          .insert(schema.predictionResults)
          .values({
            predictionId: prediction.id,
            predictionPrice: outcome.predictionPrice,
            resolutionPrice: outcome.resolutionPrice,
            realizedReturn: outcome.realizedReturn,
            benchmarkReturn: outcome.benchmarkReturn,
            alpha: outcome.alpha,
            hitTarget: outcome.hitTarget,
            resolvedAt: asOf,
          })
          .onConflictDoNothing({ target: schema.predictionResults.predictionId });

        await tx
          .update(schema.predictions)
          .set({ status: "resolved" })
          .where(eq(schema.predictions.id, prediction.id));
      });

      summary.resolved += 1;
      if (outcome.hitTarget) summary.hits += 1;
    } catch (error) {
      summary.failures.push({
        predictionId: prediction.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await audit("predictions.resolve", "prediction_cycle", today, summary);
  return summary;
}

/** Equal-weight return of the whole universe over the same window. */
async function benchmarkOver(from: string, to: string): Promise<number> {
  const client = db();
  const rows = await client
    .select({
      date: schema.benchmarkPrices.date,
      close: schema.benchmarkPrices.close,
    })
    .from(schema.benchmarkPrices)
    .where(sql`${schema.benchmarkPrices.date} in (${from}, ${to})`);

  const start = rows.find((row) => row.date === from)?.close;
  const end = rows.find((row) => row.date === to)?.close;
  if (!start || !end) return 0;
  return (end - start) / start;
}

/** ------------------------------------------------------------ leaderboard */

/**
 * Recomputes and stores the leaderboard for a cycle.
 *
 * The live leaderboard is always derived on read, so this exists purely to keep
 * a historical record — "what did the board look like in week 12" is a question
 * you cannot answer later if you only ever recompute from current data.
 */
export async function recalculateLeaderboard(cycleId: string): Promise<{ students: number }> {
  const client = requireDatabase("Recalculating the leaderboard");

  const rows = await client
    .select({
      prediction: schema.predictions,
      result: schema.predictionResults,
    })
    .from(schema.predictions)
    .leftJoin(
      schema.predictionResults,
      eq(schema.predictions.id, schema.predictionResults.predictionId),
    );

  const joined: ResolvedPrediction[] = rows.map(({ prediction, result }) => ({
    ...prediction,
    modelVersionId: prediction.modelVersionId ?? "",
    horizon: prediction.horizon as Horizon,
    status: prediction.status as ResolvedPrediction["status"],
    result: result ? { ...result, resolvedAt: result.resolvedAt.toISOString() } : null,
  }));

  const field = buildFieldContext(joined);
  const byStudent = new Map<string, ResolvedPrediction[]>();
  for (const prediction of joined) {
    const bucket = byStudent.get(prediction.studentId) ?? [];
    bucket.push(prediction);
    byStudent.set(prediction.studentId, bucket);
  }

  const scored = [...byStudent.entries()]
    .map(([studentId, own]) => {
      const metrics = computeStudentMetrics(studentId, own);
      return { studentId, metrics, score: calculateLeaderboardScore(metrics, own, field).score };
    })
    .sort((a, b) => b.score - a.score);

  await client.transaction(async (tx) => {
    await tx
      .delete(schema.leaderboardSnapshots)
      .where(eq(schema.leaderboardSnapshots.cycleId, cycleId));

    if (scored.length > 0) {
      await tx.insert(schema.leaderboardSnapshots).values(
        scored.map((entry, index) => ({
          cycleId,
          studentId: entry.studentId,
          rank: index + 1,
          score: entry.score,
          metrics: entry.metrics as never,
        })),
      );
    }
  });

  await audit("leaderboard.recalculate", "prediction_cycle", cycleId, {
    students: scored.length,
  });
  return { students: scored.length };
}

/** Horizons exported for the admin UI so its labels cannot drift from the rules. */
export const ADMIN_HORIZONS = HORIZONS;
