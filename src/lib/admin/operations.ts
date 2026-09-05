import "server-only";

import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { HORIZONS, POINTS_PER_HIT, type Horizon } from "@/config/challenge";
import { INFLUENCERS, influencerFeedUrl, isInfluencer } from "@/config/influencers";
import type { StudentConfig } from "@/config/students";
import { predictionsUrl } from "@/config/students";
import { stableHash } from "@/lib/mock/dataset";
import { findStudent, loadRoster, slugFromStudentName, upsertStudentEndpoint } from "@/lib/admin/roster";
import { fetchInfluencerFeed } from "@/lib/student-api/influencer-fetcher";
import { influencerToStudentPayload } from "@/lib/validation/influencer-contract";
import { calculateResolutionDate, cycleDeadlineAt, cycleIdFor, isoWeek, startOfIsoWeek, toIsoDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { marketDataProvider } from "@/lib/market-data";
import { computeStudentMetrics } from "@/lib/metrics";
import { calculatePredictionOutcome } from "@/lib/predictions/outcome";
import { fetchAllStudents, fetchStudentWithRetry, type FetchOutcome } from "@/lib/student-api/fetcher";
import { studentNamesMatch } from "@/lib/validation/student-contract";
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

  // Sunday 21:59 UTC (23:59 Europe/Madrid in CEST). Vercel Cron has minute
  // precision, so 23:59:59 is not expressible. Students keep their endpoint
  // updated during the week; this is when the platform pulls and locks.
  const deadline = cycleDeadlineAt(monday);

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

export async function lockCycle(cycleId: string): Promise<{
  snapshots: number;
  pendingStudentIds: string[];
  complete: boolean;
}> {
  const client = requireDatabase("Locking a cycle");
  const now = new Date();

  // Lock only snapshots that already exist. Students who failed to fetch have
  // no row, so they stay retryable. Already-locked snapshots are left untouched.
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

  const roster = await loadRoster();
  const snapshots = await client
    .select({
      studentId: schema.predictionSnapshots.studentId,
      lockedAt: schema.predictionSnapshots.lockedAt,
    })
    .from(schema.predictionSnapshots)
    .where(eq(schema.predictionSnapshots.cycleId, cycleId));

  const lockedIds = new Set(
    snapshots.filter((row) => row.lockedAt != null).map((row) => row.studentId),
  );
  const pendingStudentIds = roster
    .filter((student) => student.enabled && !lockedIds.has(student.id))
    .map((student) => student.id);

  const complete = pendingStudentIds.length === 0 && roster.length > 0;
  await client
    .update(schema.predictionCycles)
    .set({
      lockedAt: complete ? now : null,
      status: complete ? "locked" : "open",
    })
    .where(eq(schema.predictionCycles.id, cycleId));

  await audit("cycle.lock", "prediction_cycle", cycleId, {
    snapshots: locked.length,
    pending: pendingStudentIds,
    complete,
  });
  return { snapshots: locked.length, pendingStudentIds, complete };
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
  prefetched?: FetchOutcome,
): Promise<StoreResult> {
  const client = requireDatabase("Fetching a student");
  const outcome = prefetched ?? (await fetchStudentWithRetry(student));

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

  await client.transaction(async (tx) => {
    await tx
      .insert(schema.predictionSnapshots)
      .values({
        id: snapshotId,
        studentId: student.id,
        cycleId,
        modelVersionId: null,
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
          modelVersionId: null,
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
        modelVersionId: null,
        ticker: item.ticker,
        horizon: item.horizon,
        rank: item.rank,
        probability: 0,
        expectedReturn: 0,
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

  const enabled = await loadRoster();
  const students = enabled.filter((person) => !isInfluencer(person));
  const results: StoreResult[] = [];

  // `fetchAllStudents` already retries and bounds concurrency on the network
  // side; the writes are then sequential so one slow transaction cannot exhaust
  // the pool. Prefetch outcomes are passed through so nobody is fetched twice.
  const outcomes = await fetchAllStudents(students);
  const byId = new Map(students.map((student) => [student.id, student]));
  for (const outcome of outcomes) {
    const student = byId.get(outcome.studentId);
    if (!student) continue;
    results.push(await fetchAndStore(student, cycleId, outcome));
  }

  results.push(...(await fetchInfluencerFeedAndStore(cycleId)));

  await audit("cycle.fetch_all", "prediction_cycle", cycleId, {
    attempted: enabled.length,
    stored: results.filter((result) => result.stored).length,
  });

  return results;
}

function configForInfluencer(name: string, handle?: string): StudentConfig {
  const match =
    INFLUENCERS.find((person) => studentNamesMatch(person.name, name)) ??
    INFLUENCERS.find((person) => handle && person.handle === handle.replace(/^@/, ""));
  if (match) return match;
  const slug = slugFromStudentName(name);
  let origin = "https://influencer-predictions.vercel.app";
  try {
    origin = new URL(influencerFeedUrl()).origin;
  } catch {
    // keep default
  }
  return {
    id: `inf-${slug}`,
    name,
    handle: handle?.replace(/^@/, "") || slug,
    kind: "influencer",
    api: {
      baseUrl: origin,
      predictions: "/api/influencers",
      health: "/api/health",
    },
    enabled: true,
  };
}

/**
 * One HTTPS call, N people. Empty prediction lists are a successful week
 * without picks — we do not invent stocks and we do not keep them pending.
 */
export async function fetchInfluencerFeedAndStore(cycleId: string): Promise<StoreResult[]> {
  requireDatabase("Fetching influencer feed");
  const outcome = await fetchInfluencerFeed();
  const results: StoreResult[] = [];
  const roster = await loadRoster({ enabledOnly: false });
  const influencers = roster.filter((person) => isInfluencer(person));

  if (!outcome.feed) {
    for (const person of influencers.filter((item) => item.enabled)) {
      await markIntegration(person.id, {
        lastFetchAt: new Date(outcome.fetchedAt),
        lastStatus: outcome.error?.includes("within") ? "timeout" : "error",
        lastError: outcome.error,
        lastLatencyMs: outcome.latencyMs,
      });
      results.push({
        ...outcome,
        studentId: person.id,
        url: outcome.url,
        status: outcome.error?.includes("within") ? "timeout" : "error",
        payload: null,
        payloadHash: null,
        stored: false,
        predictionsStored: 0,
        storeError: outcome.error,
      });
    }
    return results;
  }

  const seen = new Set<string>();

  for (const item of outcome.feed.influencers) {
    const config = configForInfluencer(item.name, item.handle);
    const person = await upsertStudentEndpoint({
      id: config.id,
      name: config.name,
      handle: config.handle,
      url: outcome.url,
      enabled: true,
      kind: "influencer",
    });
    seen.add(person.id);

    const payload = influencerToStudentPayload(item);
    if (!payload) {
      await markIntegration(person.id, {
        lastFetchAt: new Date(outcome.fetchedAt),
        lastStatus: "healthy",
        lastError: null,
        lastLatencyMs: outcome.latencyMs,
      });
      results.push({
        studentId: person.id,
        url: outcome.url,
        status: "healthy",
        httpStatus: outcome.httpStatus,
        latencyMs: outcome.latencyMs,
        fetchedAt: outcome.fetchedAt,
        rawBody: item,
        payload: null,
        payloadHash: null,
        issues: [],
        error: null,
        stored: false,
        predictionsStored: 0,
        storeError: null,
      });
      continue;
    }

    const prefetched: FetchOutcome = {
      studentId: person.id,
      url: outcome.url,
      status: "healthy",
      httpStatus: outcome.httpStatus,
      latencyMs: outcome.latencyMs,
      fetchedAt: outcome.fetchedAt,
      rawBody: item,
      payload,
      payloadHash: stableHash(JSON.stringify(item)),
      issues: [],
      error: null,
    };
    results.push(await fetchAndStore(person, cycleId, prefetched));
  }

  for (const person of influencers.filter((item) => item.enabled && !seen.has(item.id))) {
    await markIntegration(person.id, {
      lastFetchAt: new Date(outcome.fetchedAt),
      lastStatus: "healthy",
      lastError: "not present in this week's feed",
      lastLatencyMs: outcome.latencyMs,
    });
  }

  return results;
}

async function markIntegration(
  studentId: string,
  values: {
    lastFetchAt: Date;
    lastStatus: "healthy" | "error" | "timeout" | "invalid" | "unknown";
    lastError: string | null;
    lastLatencyMs: number;
  },
): Promise<void> {
  await db()
    .update(schema.studentIntegrations)
    .set(values)
    .where(eq(schema.studentIntegrations.studentId, studentId));
}

/**
 * Re-fetches students who still have no locked snapshot in this cycle.
 *
 * Successful classmates stay frozen. A later retry cannot overwrite them.
 */
export async function retryFailedStudents(cycleId?: string): Promise<{
  cycleId: string;
  attempted: string[];
  results: StoreResult[];
  lock: Awaited<ReturnType<typeof lockCycle>>;
}> {
  requireDatabase("Retrying failed students");
  const { id } = cycleId ? { id: cycleId } : await createCycle();
  const pending = await pendingStudentIds(id);
  const results: StoreResult[] = [];

  let influencerFeedDone = false;
  for (const studentId of pending) {
    const student = await findStudent(studentId);
    if (!student?.enabled) continue;
    if (isInfluencer(student)) {
      if (!influencerFeedDone) {
        results.push(...(await fetchInfluencerFeedAndStore(id)));
        influencerFeedDone = true;
      }
      continue;
    }
    results.push(await fetchAndStore(student, id));
  }

  const lock = await lockCycle(id);
  await audit("cycle.retry_failed", "prediction_cycle", id, {
    attempted: pending,
    stored: results.filter((result) => result.stored).length,
  });

  return { cycleId: id, attempted: pending, results, lock };
}

async function pendingStudentIds(cycleId: string): Promise<string[]> {
  const client = db();
  const roster = await loadRoster();
  const snapshots = await client
    .select({
      studentId: schema.predictionSnapshots.studentId,
      lockedAt: schema.predictionSnapshots.lockedAt,
    })
    .from(schema.predictionSnapshots)
    .where(eq(schema.predictionSnapshots.cycleId, cycleId));

  const lockedIds = new Set(
    snapshots.filter((row) => row.lockedAt != null).map((row) => row.studentId),
  );
  const integrations = await client.select().from(schema.studentIntegrations);
  const integrationById = new Map(integrations.map((row) => [row.studentId, row]));

  return roster
    .filter((student) => {
      if (!student.enabled || lockedIds.has(student.id)) return false;
      if (isInfluencer(student)) {
        const integration = integrationById.get(student.id);
        if (integration?.lastStatus === "healthy") return false;
      }
      return true;
    })
    .map((student) => student.id);
}

export async function getRosterStatus(cycleId?: string): Promise<{
  cycleId: string;
  pendingStudentIds: string[];
  students: Array<{
    id: string;
    name: string;
    handle: string;
    kind: "student" | "influencer";
    url: string;
    enabled: boolean;
    lastStatus: string;
    lastError: string | null;
    lastFetchAt: string | null;
    snapshotLocked: boolean;
    hasSnapshot: boolean;
  }>;
}> {
  const client = requireDatabase("Listing student endpoints");
  const id = cycleId ?? cycleIdFor(startOfIsoWeek(new Date()));
  const roster = await loadRoster({ enabledOnly: false });
  const pending = await pendingStudentIds(id);

  const integrations = await client.select().from(schema.studentIntegrations);
  const integrationById = new Map(integrations.map((row) => [row.studentId, row]));
  const snapshots = await client
    .select({
      studentId: schema.predictionSnapshots.studentId,
      lockedAt: schema.predictionSnapshots.lockedAt,
    })
    .from(schema.predictionSnapshots)
    .where(eq(schema.predictionSnapshots.cycleId, id));
  const snapshotById = new Map(snapshots.map((row) => [row.studentId, row]));

  return {
    cycleId: id,
    pendingStudentIds: pending,
    students: roster.map((student) => {
      const integration = integrationById.get(student.id);
      const snapshot = snapshotById.get(student.id);
      return {
        id: student.id,
        name: student.name,
        handle: student.handle,
        kind: isInfluencer(student) ? "influencer" : "student",
        url: predictionsUrl(student),
        enabled: student.enabled,
        lastStatus: integration?.lastStatus ?? "unknown",
        lastError: integration?.lastError ?? null,
        lastFetchAt: integration?.lastFetchAt ? integration.lastFetchAt.toISOString() : null,
        snapshotLocked: snapshot?.lockedAt != null,
        hasSnapshot: Boolean(snapshot),
      };
    }),
  };
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

  const byStudent = new Map<string, ResolvedPrediction[]>();
  for (const prediction of joined) {
    const bucket = byStudent.get(prediction.studentId) ?? [];
    bucket.push(prediction);
    byStudent.set(prediction.studentId, bucket);
  }

  const scored = [...byStudent.entries()]
    .map(([studentId, own]) => {
      const metrics = computeStudentMetrics(studentId, own);
      return { studentId, metrics, score: metrics.hits * POINTS_PER_HIT };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.metrics.hitRate - a.metrics.hitRate;
    });

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

export interface NightlyJobResult {
  resolved: Awaited<ReturnType<typeof resolveDuePredictions>>;
  weekly: {
    ran: boolean;
    cycleId?: string;
    created?: boolean;
    fetched?: number;
    stored?: number;
    locked?: number;
    pendingStudentIds?: string[];
    complete?: boolean;
  };
}

/**
 * Weekly Sunday job (`59 21 * * 0` = 21:59 UTC = 23:59 Europe/Madrid in CEST).
 *
 * Always:
 *   1. Resolve every pick whose `resolutionDate` is today or earlier (1W, 1M,
 *      3M and 6M). Longer horizons score on the first Sunday after they mature.
 *   2. Open the week's cycle, pull every student endpoint (with retries), store
 *      valid snapshots, and lock the successes. Failures stay unlocked so
 *      `/api/admin/retry-failed` can fill them in without touching the others.
 *
 * The cron only fires on Sunday, so both steps always run. `isSunday` is kept
 * as a sanity check on the clock, not as a skip for the weekly pull.
 */
export async function runNightlyJob(now = new Date()): Promise<NightlyJobResult> {
  const resolved = await resolveDuePredictions(now);

  const { id: cycleId, created } = await createCycle(toIsoDate(now));
  const results = await fetchAllAndStore(cycleId);
  const lock = await lockCycle(cycleId);

  return {
    resolved,
    weekly: {
      ran: true,
      cycleId,
      created,
      fetched: results.length,
      stored: results.filter((result) => result.stored).length,
      locked: lock.snapshots,
      pendingStudentIds: lock.pendingStudentIds,
      complete: lock.complete,
    },
  };
}

/** Horizons exported for the admin UI so its labels cannot drift from the rules. */
export const ADMIN_HORIZONS = HORIZONS;
