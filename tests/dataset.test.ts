import { describe, expect, it } from "vitest";

import { HORIZONS, PICKS_PER_HORIZON } from "@/config/challenge";
import { mockDataset } from "@/lib/mock/dataset";
import { STUDENT_PROFILES } from "@/lib/mock/students";
import { STOCK_UNIVERSE } from "@/lib/mock/universe";

const dataset = mockDataset();

describe("mock dataset", () => {
  it("contains sixteen students and ten stocks", () => {
    expect(dataset.students).toHaveLength(16);
    expect(dataset.stocks).toHaveLength(10);
    expect(dataset.students.map((s) => s.id)).toEqual(STUDENT_PROFILES.map((s) => s.id));
    expect(dataset.stocks.map((s) => s.ticker)).toEqual(STOCK_UNIVERSE.map((s) => s.ticker));
  });

  it("is deterministic across calls", () => {
    const again = mockDataset();
    expect(again.predictions.length).toBe(dataset.predictions.length);
    expect(again.predictions[0]?.probability).toBe(dataset.predictions[0]?.probability);
    expect(again.results[0]?.realizedReturn).toBe(dataset.results[0]?.realizedReturn);
  });

  it("emits 12 predictions for every student that participates in a cycle", () => {
    const slot = HORIZONS.length * PICKS_PER_HORIZON;
    const midCycle = dataset.cycles[Math.floor(dataset.cycles.length / 2)]?.id;
    const inCycle = dataset.predictions.filter((p) => p.cycleId === midCycle);
    const byStudent = new Map<string, number>();
    for (const prediction of inCycle) {
      byStudent.set(prediction.studentId, (byStudent.get(prediction.studentId) ?? 0) + 1);
    }
    expect(byStudent.size).toBeGreaterThanOrEqual(14);
    for (const count of byStudent.values()) {
      expect(count).toBe(slot);
    }
  });

  it("leaves some predictions active and some resolved", () => {
    expect(dataset.results.length).toBeGreaterThan(1000);
    expect(dataset.predictions.some((p) => p.status === "active")).toBe(true);
    expect(dataset.predictions.some((p) => p.status === "resolved")).toBe(true);
  });

  it("never overwrites an older model generation", () => {
    const versions = dataset.modelVersions.filter((v) => v.studentId === "student-01");
    expect(versions.map((v) => v.version).sort()).toEqual(["v1", "v2", "v3"]);
    expect(versions.filter((v) => v.retiredAt === null)).toHaveLength(1);
  });

  it("keeps feature scores internally consistent", () => {
    const row = dataset.features.find((f) => f.ticker === "NVDA");
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.baselineInvestmentScore).toBeGreaterThan(0);
    expect(row.baselineInvestmentScore).toBeLessThanOrEqual(1);
    expect(row.growthScore).toBeGreaterThanOrEqual(0);
    expect(row.financialHealthScore).toBeGreaterThanOrEqual(0);
  });
});
