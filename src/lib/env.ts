/**
 * Environment access, read once and in one place.
 *
 * Defaults are chosen so that `npm run dev` on a fresh clone with no `.env`
 * file produces a fully populated, fully navigable application.
 */

/**
 * Dynamic `process.env[name]` so Next.js cannot inline an empty value at
 * build time. Static `process.env.ADMIN_TOKEN` is replaced during `next build`;
 * if the secret was missing or Sensitive-and-unavailable then, production
 * would keep seeing an empty token even after `vercel env add`.
 */
function read(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function flag(value: string | null, fallback: boolean): boolean {
  if (value === null || value === "") return fallback;
  return value === "true" || value === "1";
}

function supabaseDatabaseUrl(): string | null {
  const explicit = read("DATABASE_URL");
  if (explicit) return explicit;

  const id = read("SUPABASE_PROJECT_ID");
  const region = read("SUPABASE_PROJECT_REGION");
  const password = read("SUPABASE_DB_PASSWORD");
  if (!id || !region || !password) return null;

  const prefix = read("SUPABASE_POOLER_PREFIX") || "aws-0";
  return `postgresql://postgres.${id}:${encodeURIComponent(password)}@${prefix}-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
}

const databaseUrl = supabaseDatabaseUrl();

export const env = {
  siteUrl: read("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000",

  /**
   * Mock mode is on unless it is explicitly disabled *and* a database is
   * configured. Getting this wrong would show an empty leaderboard rather than
   * an obvious error, so the safe direction is to stay in mock mode.
   */
  mockMode: flag(read("MOCK_MODE"), true) || databaseUrl === null,

  databaseUrl,
  adminToken: read("ADMIN_TOKEN"),
  cronSecret: read("CRON_SECRET"),
  marketDataProvider: (read("MARKET_DATA_PROVIDER") || "mock") as "mock" | "yahoo",
  studentFetchTimeoutMs: Number(read("STUDENT_FETCH_TIMEOUT_MS") ?? 8000),
  influencerFeedUrl:
    read("INFLUENCER_FEED_URL") || "https://influencer-predictions.vercel.app/api/influencers",
  influencerFetchTimeoutMs: Number(read("INFLUENCER_FETCH_TIMEOUT_MS") ?? 15000),
  noindex: flag(read("NEXT_PUBLIC_NOINDEX"), false),

  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/rest\/v1\/?$/, "") || null,
  supabasePublishableKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: read("SUPABASE_SECRET_KEY"),
  supabaseProjectId: read("SUPABASE_PROJECT_ID"),
} as const;

export type Env = typeof env;
