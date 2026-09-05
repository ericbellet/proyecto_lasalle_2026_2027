CREATE TABLE IF NOT EXISTS "influencer_ingest_state" (
  "id" text PRIMARY KEY,
  "payload" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
