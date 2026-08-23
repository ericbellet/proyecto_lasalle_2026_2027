import { describe, expect, it } from "vitest";

import {
  calculateResolutionDate,
  isMarketDay,
  nearestMarketDay,
  parseIsoDate,
  toIsoDate,
} from "@/lib/dates";

describe("calculateResolutionDate", () => {
  it("projects 1W by seven calendar days and snaps to a market day", () => {
    const resolved = calculateResolutionDate("2026-03-09", "1W");
    expect(toIsoDate(resolved)).toBe("2026-03-16");
  });

  it("projects 1M by 30 days", () => {
    const resolved = calculateResolutionDate("2026-03-09", "1M");
    expect(toIsoDate(resolved)).toBe("2026-04-08");
  });

  it("projects 3M by 91 days", () => {
    const resolved = calculateResolutionDate("2026-03-09", "3M");
    expect(toIsoDate(resolved)).toBe("2026-06-08");
  });

  it("projects 6M by 182 days", () => {
    const resolved = calculateResolutionDate("2026-03-09", "6M");
    expect(toIsoDate(resolved)).toBe("2026-09-08");
  });

  it("walks forward when the projected day is a weekend", () => {
    // 2026-09-07 is Labour Day (Monday holiday). 1W from 2026-08-31 is 2026-09-07.
    const resolved = calculateResolutionDate("2026-08-31", "1W");
    expect(isMarketDay(resolved)).toBe(true);
    expect(toIsoDate(resolved) > "2026-09-07").toBe(true);
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
