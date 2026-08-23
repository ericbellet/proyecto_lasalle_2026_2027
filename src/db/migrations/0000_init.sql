CREATE TABLE IF NOT EXISTS "students" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "handle" text NOT NULL UNIQUE,
  "avatar_seed" text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "student_integrations" (
  "student_id" text PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
  "base_url" text NOT NULL,
  "predictions_endpoint" text DEFAULT '/api/predictions' NOT NULL,
  "health_endpoint" text,
  "api_key_env_var" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_fetch_at" timestamp with time zone,
  "last_status" text DEFAULT 'unknown' NOT NULL,
  "last_error" text,
  "last_latency_ms" integer
);

CREATE TABLE IF NOT EXISTS "model_versions" (
  "id" text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "version" text NOT NULL,
  "name" text NOT NULL,
  "research_area" text NOT NULL,
  "approach" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "model_versions_student_version" ON "model_versions" ("student_id", "version");

CREATE TABLE IF NOT EXISTS "prediction_cycles" (
  "id" text PRIMARY KEY,
  "label" text NOT NULL,
  "week_number" integer NOT NULL,
  "year" integer NOT NULL,
  "opens_at" timestamp with time zone NOT NULL,
  "deadline_at" timestamp with time zone NOT NULL,
  "locked_at" timestamp with time zone,
  "status" text DEFAULT 'open' NOT NULL
);

CREATE TABLE IF NOT EXISTS "prediction_snapshots" (
  "id" text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "cycle_id" text NOT NULL REFERENCES "prediction_cycles"("id") ON DELETE CASCADE,
  "model_version_id" text REFERENCES "model_versions"("id"),
  "raw_payload" jsonb NOT NULL,
  "payload_hash" text NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_student_cycle" ON "prediction_snapshots" ("student_id", "cycle_id");

CREATE TABLE IF NOT EXISTS "predictions" (
  "id" text PRIMARY KEY,
  "snapshot_id" text NOT NULL REFERENCES "prediction_snapshots"("id") ON DELETE CASCADE,
  "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "cycle_id" text NOT NULL REFERENCES "prediction_cycles"("id") ON DELETE CASCADE,
  "model_version_id" text REFERENCES "model_versions"("id"),
  "ticker" text NOT NULL,
  "horizon" text NOT NULL,
  "rank" integer NOT NULL,
  "probability" double precision NOT NULL,
  "expected_return" double precision NOT NULL,
  "target_price" double precision,
  "investment_thesis" text,
  "risks" text,
  "prediction_date" date NOT NULL,
  "resolution_date" date NOT NULL,
  "status" text DEFAULT 'active' NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "prediction_unique_slot" ON "predictions" ("student_id", "cycle_id", "horizon", "rank");
CREATE INDEX IF NOT EXISTS "prediction_ticker_idx" ON "predictions" ("ticker");
CREATE INDEX IF NOT EXISTS "prediction_resolution_idx" ON "predictions" ("status", "resolution_date");

CREATE TABLE IF NOT EXISTS "prediction_results" (
  "prediction_id" text PRIMARY KEY REFERENCES "predictions"("id") ON DELETE CASCADE,
  "prediction_price" double precision NOT NULL,
  "resolution_price" double precision NOT NULL,
  "realized_return" double precision NOT NULL,
  "benchmark_return" double precision DEFAULT 0 NOT NULL,
  "alpha" double precision DEFAULT 0 NOT NULL,
  "hit_target" boolean NOT NULL,
  "resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stocks" (
  "ticker" text PRIMARY KEY,
  "company_name" text NOT NULL,
  "sector" text NOT NULL,
  "industry" text NOT NULL,
  "country" text NOT NULL,
  "market_cap" double precision NOT NULL,
  "employees" integer NOT NULL,
  "peer_group" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "market_prices" (
  "ticker" text NOT NULL REFERENCES "stocks"("ticker") ON DELETE CASCADE,
  "date" date NOT NULL,
  "open" double precision NOT NULL,
  "high" double precision NOT NULL,
  "low" double precision NOT NULL,
  "close" double precision NOT NULL,
  "adjusted_close" double precision NOT NULL,
  "volume" double precision NOT NULL,
  PRIMARY KEY ("ticker", "date")
);

CREATE TABLE IF NOT EXISTS "benchmark_prices" (
  "date" date PRIMARY KEY,
  "close" double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_features" (
  "ticker" text NOT NULL REFERENCES "stocks"("ticker") ON DELETE CASCADE,
  "snapshot_date" date NOT NULL,
  "payload" jsonb NOT NULL,
  "baseline_investment_score" double precision,
  PRIMARY KEY ("ticker", "snapshot_date")
);

CREATE TABLE IF NOT EXISTS "leaderboard_snapshots" (
  "cycle_id" text NOT NULL REFERENCES "prediction_cycles"("id") ON DELETE CASCADE,
  "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "rank" integer NOT NULL,
  "score" double precision NOT NULL,
  "metrics" jsonb NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("cycle_id", "student_id")
);

CREATE TABLE IF NOT EXISTS "weekly_winners" (
  "cycle_id" text PRIMARY KEY REFERENCES "prediction_cycles"("id") ON DELETE CASCADE,
  "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "hits" integer NOT NULL,
  "resolved" integer NOT NULL,
  "average_return" double precision NOT NULL,
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor" text DEFAULT 'system' NOT NULL,
  "detail" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_logs" ("entity_type", "entity_id");
