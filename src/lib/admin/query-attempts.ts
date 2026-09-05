import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { env } from "@/lib/env";
import type { IntegrationStatus } from "@/lib/types";

export type QuerySource = "student_endpoint" | "influencer_feed" | "influencer_channel" | "market_price";
export type QueryKind = "student" | "influencer" | "market";

export interface QueryAttemptInput {
  source: QuerySource;
  subjectId: string;
  subjectName: string;
  kind: QueryKind;
  cycleId?: string | null;
  ticker?: string | null;
  url?: string | null;
  ok: boolean;
  status: IntegrationStatus;
  httpStatus?: number | null;
  errorMessage?: string | null;
  detail?: unknown;
  latencyMs?: number | null;
  attemptedAt?: Date;
}

export interface QueryAttemptRow {
  id: string;
  source: QuerySource;
  subjectId: string;
  subjectName: string;
  kind: QueryKind;
  cycleId: string | null;
  ticker: string | null;
  url: string | null;
  ok: boolean;
  status: string;
  httpStatus: number | null;
  errorMessage: string | null;
  detail: unknown;
  latencyMs: number | null;
  attemptedAt: string;
}

function attemptId(): string {
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Persist one query. Never throws — a logging failure must not abort Sunday. */
export async function recordQueryAttempt(input: QueryAttemptInput): Promise<void> {
  if (env.mockMode || !env.databaseUrl) return;
  try {
    await db()
      .insert(schema.queryAttempts)
      .values({
        id: attemptId(),
        source: input.source,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        kind: input.kind,
        cycleId: input.cycleId ?? null,
        ticker: input.ticker ?? null,
        url: input.url ?? null,
        ok: input.ok,
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        errorMessage: input.errorMessage ?? null,
        detail: (input.detail ?? null) as never,
        latencyMs: input.latencyMs ?? null,
        attemptedAt: input.attemptedAt ?? new Date(),
      });
  } catch (error) {
    console.error("[query-attempt]", error);
  }
}

export interface QueryAttemptFilter {
  failedOnly?: boolean;
  source?: QuerySource | "all";
  limit?: number;
}

export async function listQueryAttempts(filter: QueryAttemptFilter = {}): Promise<QueryAttemptRow[]> {
  const client = db();
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  const clauses = [];
  if (filter.failedOnly) clauses.push(eq(schema.queryAttempts.ok, false));
  if (filter.source && filter.source !== "all") {
    clauses.push(eq(schema.queryAttempts.source, filter.source));
  }

  const rows = await client
    .select()
    .from(schema.queryAttempts)
    .where(clauses.length ? and(...clauses) : sql`true`)
    .orderBy(desc(schema.queryAttempts.attemptedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    source: row.source as QuerySource,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    kind: row.kind as QueryKind,
    cycleId: row.cycleId,
    ticker: row.ticker,
    url: row.url,
    ok: row.ok,
    status: row.status,
    httpStatus: row.httpStatus,
    errorMessage: row.errorMessage,
    detail: row.detail,
    latencyMs: row.latencyMs,
    attemptedAt: row.attemptedAt.toISOString(),
  }));
}

export async function queryAttemptSummary(): Promise<{
  total: number;
  failed: number;
  failedLast24h: number;
  lastAttemptAt: string | null;
}> {
  const client = db();
  const [totals] = await client
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${schema.queryAttempts.ok} = false)::int`,
      failedLast24h: sql<number>`count(*) filter (where ${schema.queryAttempts.ok} = false and ${schema.queryAttempts.attemptedAt} > now() - interval '24 hours')::int`,
      lastAttemptAt: sql<Date | null>`max(${schema.queryAttempts.attemptedAt})`,
    })
    .from(schema.queryAttempts);

  return {
    total: totals?.total ?? 0,
    failed: totals?.failed ?? 0,
    failedLast24h: totals?.failedLast24h ?? 0,
    lastAttemptAt: totals?.lastAttemptAt ? totals.lastAttemptAt.toISOString() : null,
  };
}
