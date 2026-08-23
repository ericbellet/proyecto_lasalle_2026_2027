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

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

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
  marketDataProvider: (process.env.MARKET_DATA_PROVIDER?.trim() || "mock") as "mock" | "yahoo",
  studentFetchTimeoutMs: Number(process.env.STUDENT_FETCH_TIMEOUT_MS ?? 8000),
  noindex: flag(process.env.NEXT_PUBLIC_NOINDEX, false),
} as const;

export type Env = typeof env;
