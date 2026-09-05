CREATE TABLE IF NOT EXISTS "query_attempts" (
  "id" text PRIMARY KEY,
  "source" text NOT NULL,
  "subject_id" text NOT NULL,
  "subject_name" text NOT NULL,
  "kind" text NOT NULL,
  "cycle_id" text,
  "ticker" text,
  "url" text,
  "ok" boolean NOT NULL,
  "status" text NOT NULL,
  "http_status" integer,
  "error_message" text,
  "detail" jsonb,
  "latency_ms" integer,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "query_attempts_attempted_idx" ON "query_attempts" ("attempted_at");
CREATE INDEX IF NOT EXISTS "query_attempts_source_ok_idx" ON "query_attempts" ("source", "ok");
