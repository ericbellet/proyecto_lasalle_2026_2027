import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Central schema — plain PostgreSQL.
 *
 * Nothing here is Neon- or Supabase-specific: no extensions, no RLS policies,
 * no vendor types. A `DATABASE_URL` pointing at either provider, or at a local
 * Postgres, runs the same migrations.
 *
 * The integrity rule the whole competition rests on lives in
 * `prediction_snapshots`: once `locked_at` is set the row is never updated
 * again. Corrections go through `audit_logs`, never through a silent overwrite.
 */

export const students = pgTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  avatarSeed: text("avatar_seed").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentIntegrations = pgTable("student_integrations", {
  studentId: text("student_id")
    .primaryKey()
    .references(() => students.id, { onDelete: "cascade" }),
  baseUrl: text("base_url").notNull(),
  predictionsEndpoint: text("predictions_endpoint").notNull().default("/api/predictions"),
  healthEndpoint: text("health_endpoint"),
  /**
   * Name of the environment variable holding the student's bearer token — never
   * the token itself. Secrets stay in the deployment environment so a database
   * dump cannot leak sixteen students' credentials.
   */
  apiKeyEnvVar: text("api_key_env_var"),
  enabled: boolean("enabled").notNull().default(true),
  lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
  lastStatus: text("last_status").notNull().default("unknown"),
  lastError: text("last_error"),
  lastLatencyMs: integer("last_latency_ms"),
});

export const modelVersions = pgTable(
  "model_versions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    name: text("name").notNull(),
    researchArea: text("research_area").notNull(),
    approach: text("approach").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("model_versions_student_version").on(table.studentId, table.version)],
);

export const predictionCycles = pgTable("prediction_cycles", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
});

export const predictionSnapshots = pgTable(
  "prediction_snapshots",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => predictionCycles.id, { onDelete: "cascade" }),
    modelVersionId: text("model_version_id").references(() => modelVersions.id),
    /** The student's response exactly as received, before normalisation. */
    rawPayload: jsonb("raw_payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("snapshot_student_cycle").on(table.studentId, table.cycleId)],
);

export const predictions = pgTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => predictionSnapshots.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => predictionCycles.id, { onDelete: "cascade" }),
    modelVersionId: text("model_version_id").references(() => modelVersions.id),
    ticker: text("ticker").notNull(),
    horizon: text("horizon").notNull(),
    rank: integer("rank").notNull(),
    probability: doublePrecision("probability").notNull(),
    expectedReturn: doublePrecision("expected_return").notNull(),
    targetPrice: doublePrecision("target_price"),
    investmentThesis: text("investment_thesis"),
    risks: text("risks"),
    predictionDate: date("prediction_date").notNull(),
    resolutionDate: date("resolution_date").notNull(),
    status: text("status").notNull().default("active"),
  },
  (table) => [
    uniqueIndex("prediction_unique_slot").on(
      table.studentId,
      table.cycleId,
      table.horizon,
      table.rank,
    ),
    index("prediction_ticker_idx").on(table.ticker),
    index("prediction_resolution_idx").on(table.status, table.resolutionDate),
  ],
);

export const predictionResults = pgTable("prediction_results", {
  predictionId: text("prediction_id")
    .primaryKey()
    .references(() => predictions.id, { onDelete: "cascade" }),
  predictionPrice: doublePrecision("prediction_price").notNull(),
  resolutionPrice: doublePrecision("resolution_price").notNull(),
  realizedReturn: doublePrecision("realized_return").notNull(),
  benchmarkReturn: doublePrecision("benchmark_return").notNull().default(0),
  alpha: doublePrecision("alpha").notNull().default(0),
  hitTarget: boolean("hit_target").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stocks = pgTable("stocks", {
  ticker: text("ticker").primaryKey(),
  companyName: text("company_name").notNull(),
  sector: text("sector").notNull(),
  industry: text("industry").notNull(),
  country: text("country").notNull(),
  marketCap: doublePrecision("market_cap").notNull(),
  employees: integer("employees").notNull(),
  peerGroup: jsonb("peer_group").$type<string[]>().notNull().default([]),
});

export const marketPrices = pgTable(
  "market_prices",
  {
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker, { onDelete: "cascade" }),
    date: date("date").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    adjustedClose: doublePrecision("adjusted_close").notNull(),
    volume: doublePrecision("volume").notNull(),
  },
  (table) => [primaryKey({ columns: [table.ticker, table.date] })],
);

export const benchmarkPrices = pgTable("benchmark_prices", {
  date: date("date").primaryKey(),
  close: doublePrecision("close").notNull(),
});

/**
 * The point-in-time feature table. One row is a ticker as it was knowable on
 * `snapshot_date`. Stored as JSONB because the column set is the students'
 * design space and will change every year; the platform only reads a handful of
 * fields for display.
 */
export const stockFeatures = pgTable(
  "stock_features",
  {
    ticker: text("ticker")
      .notNull()
      .references(() => stocks.ticker, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    payload: jsonb("payload").notNull(),
    baselineInvestmentScore: doublePrecision("baseline_investment_score"),
  },
  (table) => [primaryKey({ columns: [table.ticker, table.snapshotDate] })],
);

export const leaderboardSnapshots = pgTable(
  "leaderboard_snapshots",
  {
    cycleId: text("cycle_id")
      .notNull()
      .references(() => predictionCycles.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    score: doublePrecision("score").notNull(),
    metrics: jsonb("metrics").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.cycleId, table.studentId] })],
);

export const weeklyWinners = pgTable("weekly_winners", {
  cycleId: text("cycle_id")
    .primaryKey()
    .references(() => predictionCycles.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  hits: integer("hits").notNull(),
  resolved: integer("resolved").notNull(),
  averageReturn: doublePrecision("average_return").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only trail. Every fetch, lock, resolution and manual correction lands
 * here, which is what makes a disputed grade answerable months later.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    actor: text("actor").notNull().default("system"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);
