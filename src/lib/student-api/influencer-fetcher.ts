import "server-only";

import { influencerFeedUrl } from "@/config/influencers";
import { env } from "@/lib/env";
import {
  validateInfluencerFeed,
  type InfluencerFeed,
} from "@/lib/validation/influencer-contract";
import { reportedQueryError, summariseIssues, type ContractIssue } from "@/lib/validation/student-contract";

export interface InfluencerFeedOutcome {
  url: string;
  httpStatus: number | null;
  latencyMs: number;
  fetchedAt: string;
  rawBody: unknown;
  feed: InfluencerFeed | null;
  issues: ContractIssue[];
  error: string | null;
}

export async function fetchInfluencerFeed(options?: { timeoutMs?: number }): Promise<InfluencerFeedOutcome> {
  const url = influencerFeedUrl();
  const timeoutMs = options?.timeoutMs ?? env.influencerFetchTimeoutMs;
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();

  const base: InfluencerFeedOutcome = {
    url,
    httpStatus: null,
    latencyMs: 0,
    fetchedAt,
    rawBody: null,
    feed: null,
    issues: [],
    error: null,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "value-investing-challenge/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: text.slice(0, 4000),
        error: "Influencer feed is not valid JSON",
      };
    }

    const reported = reportedQueryError(body);
    const validated = validateInfluencerFeed(body);
    if (!validated.ok) {
      return {
        ...base,
        latencyMs,
        httpStatus: response.status,
        rawBody: body,
        issues: validated.issues,
        error:
          reported ??
          (!response.ok
            ? `HTTP ${response.status} ${response.statusText}`.trim()
            : summariseIssues(validated.issues)),
      };
    }

    return {
      ...base,
      latencyMs,
      httpStatus: response.status,
      rawBody: body,
      feed: validated.feed,
      error: reported ?? validated.feed.error ?? null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ...base,
      latencyMs,
      error: aborted
        ? `No response within ${timeoutMs} ms`
        : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
