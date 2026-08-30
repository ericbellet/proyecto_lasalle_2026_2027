import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

function databaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();

  const id = process.env.SUPABASE_PROJECT_ID?.trim();
  const region = process.env.SUPABASE_PROJECT_REGION?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (id && region && password) {
    const prefix = process.env.SUPABASE_POOLER_PREFIX?.trim() || "aws-0";
    return `postgresql://postgres.${id}:${encodeURIComponent(password)}@${prefix}-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
  }

  return "postgresql://postgres:postgres@localhost:5432/vic";
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl(),
  },
});
