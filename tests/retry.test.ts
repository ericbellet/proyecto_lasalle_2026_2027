import { describe, expect, it } from "vitest";

import { parsePredictionsUrl, RosterError } from "@/lib/admin/endpoint-url";
import { isRetryableFetch, retryDelayMs } from "@/lib/student-api/retry";

describe("isRetryableFetch", () => {
  it("retries timeouts, HTTP errors and non-JSON bodies", () => {
    expect(isRetryableFetch("timeout", "No response within 8000 ms")).toBe(true);
    expect(isRetryableFetch("error", "HTTP 502")).toBe(true);
    expect(isRetryableFetch("invalid", "Response body is not valid JSON")).toBe(true);
  });

  it("does not retry a Zod miss or a healthy payload", () => {
    expect(isRetryableFetch("invalid", "predictions.0.rank: duplicate rank 1 for horizon 1W")).toBe(
      false,
    );
    expect(isRetryableFetch("healthy", null)).toBe(false);
  });
});

describe("retryDelayMs", () => {
  it("doubles after each attempt", () => {
    expect(retryDelayMs(0, 500)).toBe(500);
    expect(retryDelayMs(1, 500)).toBe(1000);
    expect(retryDelayMs(2, 500)).toBe(2000);
  });
});

describe("parsePredictionsUrl", () => {
  it("defaults a bare origin to /api/predictions", () => {
    expect(parsePredictionsUrl("https://lgarcia-investing.vercel.app")).toEqual({
      baseUrl: "https://lgarcia-investing.vercel.app",
      predictions: "/api/predictions",
    });
  });

  it("keeps an explicit predictions path", () => {
    expect(parsePredictionsUrl("https://lgarcia-investing.vercel.app/api/predictions")).toEqual({
      baseUrl: "https://lgarcia-investing.vercel.app",
      predictions: "/api/predictions",
    });
  });

  it("rejects an empty URL", () => {
    expect(() => parsePredictionsUrl("  ")).toThrow(RosterError);
  });
});
