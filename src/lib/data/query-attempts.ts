import "server-only";

import {
  listQueryAttempts,
  queryAttemptSummary,
  type QueryAttemptFilter,
  type QueryAttemptRow,
} from "@/lib/admin/query-attempts";
import { env } from "@/lib/env";
import { mockQueryAttemptSummary, mockQueryAttempts } from "@/lib/mock/query-attempts";

export async function getQueryAttemptsPage(filter: QueryAttemptFilter = {}): Promise<{
  attempts: QueryAttemptRow[];
  summary: {
    total: number;
    failed: number;
    failedLast24h: number;
    lastAttemptAt: string | null;
  };
  mock: boolean;
}> {
  if (env.mockMode || !env.databaseUrl) {
    return {
      attempts: mockQueryAttempts(filter),
      summary: mockQueryAttemptSummary(),
      mock: true,
    };
  }

  return {
    attempts: await listQueryAttempts(filter),
    summary: await queryAttemptSummary(),
    mock: false,
  };
}
