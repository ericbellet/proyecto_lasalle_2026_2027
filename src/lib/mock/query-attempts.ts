import type { QueryAttemptRow, QuerySource } from "@/lib/admin/query-attempts";

const NOW = Date.parse("2026-09-05T17:00:00.000Z");

function at(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString();
}

const MOCK: QueryAttemptRow[] = [
  {
    id: "qa-mock-1",
    source: "student_endpoint",
    subjectId: "student-04",
    subjectName: "Marta Vidal",
    kind: "student",
    cycleId: "2026-W36",
    ticker: null,
    url: "https://mvidal-investing.vercel.app/api/predictions",
    ok: false,
    status: "error",
    httpStatus: 502,
    errorMessage: "Yahoo Finance timeout while building this week's picks",
    detail: null,
    latencyMs: 8012,
    attemptedAt: at(2),
  },
  {
    id: "qa-mock-2",
    source: "influencer_channel",
    subjectId: "inf-arte-de-invertir",
    subjectName: "Arte de Invertir",
    kind: "influencer",
    cycleId: "2026-W36",
    ticker: null,
    url: "https://influencer-predictions.vercel.app/api/influencers",
    ok: false,
    status: "error",
    httpStatus: 200,
    errorMessage: "YouTube RSS 503 for UC-yJ1V3fN75A4dlR6dgRgEg",
    detail: null,
    latencyMs: 420,
    attemptedAt: at(3),
  },
  {
    id: "qa-mock-3",
    source: "market_price",
    subjectId: "pred-meta-1w",
    subjectName: "Eric Bellet · META",
    kind: "market",
    cycleId: null,
    ticker: "META",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/META",
    ok: false,
    status: "error",
    httpStatus: null,
    errorMessage: "No price on or before 2026-08-29",
    detail: { predictionDate: "2026-08-22", resolutionDate: "2026-08-29" },
    latencyMs: 310,
    attemptedAt: at(5),
  },
  {
    id: "qa-mock-4",
    source: "student_endpoint",
    subjectId: "eric-bellet",
    subjectName: "Eric Bellet",
    kind: "student",
    cycleId: "2026-W36",
    ticker: null,
    url: "https://eric-bellet-investing.vercel.app/api/predictions",
    ok: true,
    status: "healthy",
    httpStatus: 200,
    errorMessage: null,
    detail: null,
    latencyMs: 188,
    attemptedAt: at(2.1),
  },
  {
    id: "qa-mock-5",
    source: "influencer_feed",
    subjectId: "influencer-feed",
    subjectName: "Influencer feed",
    kind: "influencer",
    cycleId: "2026-W36",
    ticker: null,
    url: "https://influencer-predictions.vercel.app/api/influencers",
    ok: true,
    status: "healthy",
    httpStatus: 200,
    errorMessage: null,
    detail: null,
    latencyMs: 240,
    attemptedAt: at(3.1),
  },
  {
    id: "qa-mock-6",
    source: "market_price",
    subjectId: "pred-aapl-1m",
    subjectName: "Eric Bellet · AAPL",
    kind: "market",
    cycleId: null,
    ticker: "AAPL",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/AAPL",
    ok: true,
    status: "healthy",
    httpStatus: null,
    errorMessage: null,
    detail: { entry: 189.2, exit: 214.1 },
    latencyMs: 260,
    attemptedAt: at(6),
  },
];

export function mockQueryAttempts(options?: {
  failedOnly?: boolean;
  source?: QuerySource | "all";
}): QueryAttemptRow[] {
  return MOCK.filter((row) => {
    if (options?.failedOnly && row.ok) return false;
    if (options?.source && options.source !== "all" && row.source !== options.source) return false;
    return true;
  });
}

export function mockQueryAttemptSummary() {
  const failed = MOCK.filter((row) => !row.ok);
  return {
    total: MOCK.length,
    failed: failed.length,
    failedLast24h: failed.length,
    lastAttemptAt: MOCK[0]?.attemptedAt ?? null,
  };
}
