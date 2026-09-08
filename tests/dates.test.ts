import { describe, expect, it } from "vitest";

import {
  calculateResolutionDate,
  cycleDeadlineAt,
  isMarketDay,
  nearestMarketDay,
  parseIsoDate,
  toIsoDate,
} from "@/lib/dates";

describe("calculateResolutionDate", () => {
  it("projects 1W to the next championship Sunday", () => {
    const resolved = calculateResolutionDate("2026-03-09", "1W");
    expect(toIsoDate(resolved)).toBe("2026-03-22");
    expect(resolved.getUTCDay()).toBe(0);
  });

  it("projects 1M by four championship weeks", () => {
    const resolved = calculateResolutionDate("2026-03-09", "1M");
    expect(toIsoDate(resolved)).toBe("2026-04-12");
  });

  it("projects 3M by thirteen championship weeks", () => {
    const resolved = calculateResolutionDate("2026-03-09", "3M");
    expect(toIsoDate(resolved)).toBe("2026-06-14");
  });

  it("projects 6M by twenty-six championship weeks", () => {
    const resolved = calculateResolutionDate("2026-03-09", "6M");
    expect(toIsoDate(resolved)).toBe("2026-09-13");
  });

  it("keeps a holiday week on the Sunday championship cadence", () => {
    const resolved = calculateResolutionDate("2026-08-31", "1W");
    expect(toIsoDate(resolved)).toBe("2026-09-13");
    expect(isMarketDay(resolved)).toBe(false);
  });
});

describe("cycleDeadlineAt", () => {
  it("is Sunday 21:59 UTC of the ISO week", () => {
    const deadline = cycleDeadlineAt(parseIsoDate("2026-08-24"));
    expect(toIsoDate(deadline)).toBe("2026-08-30");
    expect(deadline.getUTCHours()).toBe(21);
    expect(deadline.getUTCMinutes()).toBe(59);
    expect(deadline.getUTCDay()).toBe(0);
  });
});

describe("nearestMarketDay", () => {
  it("returns the same day when the session is open", () => {
    const monday = parseIsoDate("2026-03-09");
    expect(toIsoDate(nearestMarketDay(monday, 1))).toBe("2026-03-09");
  });

  it("walks forward from a Saturday", () => {
    const saturday = parseIsoDate("2026-03-14");
    expect(toIsoDate(nearestMarketDay(saturday, 1))).toBe("2026-03-16");
  });

  it("walks backward from a Saturday for entry prices", () => {
    const saturday = parseIsoDate("2026-03-14");
    expect(toIsoDate(nearestMarketDay(saturday, -1))).toBe("2026-03-13");
  });
});
