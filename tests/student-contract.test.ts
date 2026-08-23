import { describe, expect, it } from "vitest";

import { EXAMPLE_PAYLOAD, validateStudentPayload } from "@/lib/validation/student-contract";

const valid = {
  student_id: "student-01",
  model_version: "v2",
  generated_at: "2026-09-14T12:00:00Z",
  predictions: [
    { ticker: "META", horizon: "1W", rank: 1, probability: 0.71, expected_return: 0.14 },
    { ticker: "NVDA", horizon: "1W", rank: 2, probability: 0.68, expected_return: 0.13 },
    { ticker: "AAPL", horizon: "1W", rank: 3, probability: 0.55, expected_return: 0.11 },
  ],
};

describe("validateStudentPayload", () => {
  it("accepts the documented example payload", () => {
    const result = validateStudentPayload(EXAMPLE_PAYLOAD);
    expect(result.ok).toBe(true);
  });

  it("accepts a well-formed student response", () => {
    const result = validateStudentPayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.predictions[0]?.ticker).toBe("META");
  });

  it("uppercases tickers", () => {
    const result = validateStudentPayload({
      ...valid,
      predictions: [{ ticker: "meta", horizon: "1W", rank: 1, probability: 0.5, expected_return: 0.1 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.predictions[0]?.ticker).toBe("META");
  });

  it("rejects a duplicate rank inside the same horizon", () => {
    const result = validateStudentPayload({
      ...valid,
      predictions: [
        { ticker: "META", horizon: "1W", rank: 1, probability: 0.7, expected_return: 0.12 },
        { ticker: "NVDA", horizon: "1W", rank: 1, probability: 0.6, expected_return: 0.11 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.message.includes("duplicate rank"))).toBe(true);
    }
  });

  it("rejects the same ticker twice in one horizon", () => {
    const result = validateStudentPayload({
      ...valid,
      predictions: [
        { ticker: "NVDA", horizon: "1M", rank: 1, probability: 0.7, expected_return: 0.12 },
        { ticker: "NVDA", horizon: "1M", rank: 2, probability: 0.6, expected_return: 0.11 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.message.includes("appears twice"))).toBe(true);
    }
  });

  it("rejects a probability outside [0, 1]", () => {
    const result = validateStudentPayload({
      ...valid,
      predictions: [{ ticker: "AAPL", horizon: "1W", rank: 1, probability: 1.4, expected_return: 0.1 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects generated_at without a timezone offset", () => {
    const result = validateStudentPayload({ ...valid, generated_at: "2026-09-14T12:00:00" });
    expect(result.ok).toBe(false);
  });

  it("rejects more than 12 predictions", () => {
    const predictions = Array.from({ length: 13 }, (_, index) => ({
      ticker: `T${index}`,
      horizon: "1W" as const,
      rank: (index % 3) + 1,
      probability: 0.4,
      expected_return: 0.1,
    }));
    const result = validateStudentPayload({ ...valid, predictions });
    expect(result.ok).toBe(false);
  });
});
