import type { IntegrationStatus } from "@/lib/types";

/** Attempts per student during the Sunday pull (first try + two retries). */
export const FETCH_RETRY_ATTEMPTS = 3;

/** Base backoff in ms; doubles after each failed attempt (`500`, `1000`). */
export const FETCH_RETRY_BASE_MS = 500;

/**
 * Network / platform failures are worth retrying. A Zod contract miss is not:
 * the payload is already valid JSON and will fail the same way on the next try.
 */
export function isRetryableFetch(status: IntegrationStatus, error: string | null): boolean {
  if (status === "healthy") return false;
  if (status === "timeout" || status === "error") return true;
  if (status === "invalid" && error === "Response body is not valid JSON") return true;
  return false;
}

export function retryDelayMs(attemptIndex: number, baseMs = FETCH_RETRY_BASE_MS): number {
  return baseMs * 2 ** attemptIndex;
}
