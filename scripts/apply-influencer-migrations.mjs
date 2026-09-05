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
  ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'student' NOT NULL
`);
await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS "influencer_ingest_state" (
    "id" text PRIMARY KEY,
    "payload" jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`);

const columns = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'students' AND column_name = 'kind'
`;
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'influencer_ingest_state'
`;
await sql.end({ timeout: 5 });

if (columns.length === 0) throw new Error("students.kind was not created");
if (tables.length === 0) throw new Error("influencer_ingest_state was not created");
console.log("Migrations applied: students.kind, influencer_ingest_state");
