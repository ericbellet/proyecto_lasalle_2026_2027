import { readFileSync } from "node:fs";
import postgres from "postgres";

function databaseUrl() {
  const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const line = text.split(/\n/).find((row) => row.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL missing");
  let value = line.slice("DATABASE_URL=".length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const sql = postgres(databaseUrl(), {
  max: 1,
  prepare: false,
  ssl: "require",
});

await sql.unsafe(`
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
  )
`);
await sql.unsafe(
  `CREATE INDEX IF NOT EXISTS "query_attempts_attempted_idx" ON "query_attempts" ("attempted_at")`,
);
await sql.unsafe(
  `CREATE INDEX IF NOT EXISTS "query_attempts_source_ok_idx" ON "query_attempts" ("source", "ok")`,
);

const tables = await sql`
  SELECT table_name FROM information_schema.tables WHERE table_name = 'query_attempts'
`;
await sql.end({ timeout: 5 });
if (tables.length === 0) throw new Error("query_attempts was not created");
console.log("Migration applied: query_attempts");
