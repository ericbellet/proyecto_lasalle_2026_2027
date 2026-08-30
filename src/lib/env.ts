/**
 * Environment access, read once and in one place.
 *
 * Defaults are chosen so that `npm run dev` on a fresh clone with no `.env`
 * file produces a fully populated, fully navigable application.
 */

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function supabaseDatabaseUrl(): string | null {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;

  const id = process.env.SUPABASE_PROJECT_ID?.trim();
  const region = process.env.SUPABASE_PROJECT_REGION?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!id || !region || !password) return null;

  const prefix = process.env.SUPABASE_POOLER_PREFIX?.trim() || "aws-0";
  return `postgresql://postgres.${id}:${encodeURIComponent(password)}@${prefix}-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
}

const databaseUrl = supabaseDatabaseUrl();

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",

  /**
   * Mock mode is on unless it is explicitly disabled *and* a database is
   * configured. Getting this wrong would show an empty leaderboard rather than
   * an obvious error, so the safe direction is to stay in mock mode.
   */
  mockMode: flag(process.env.MOCK_MODE, true) || databaseUrl === null,

  databaseUrl,
  adminToken: process.env.ADMIN_TOKEN?.trim() || null,
  cronSecret: process.env.CRON_SECRET?.trim() || null,
  marketDataProvider: (process.env.MARKET_DATA_PROVIDER?.trim() || "mock") as "mock" | "yahoo",
  studentFetchTimeoutMs: Number(process.env.STUDENT_FETCH_TIMEOUT_MS ?? 8000),
  noindex: flag(process.env.NEXT_PUBLIC_NOINDEX, false),

  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "") || null,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || null,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY?.trim() || null,
  supabaseProjectId: process.env.SUPABASE_PROJECT_ID?.trim() || null,
} as const;

export type Env = typeof env;
