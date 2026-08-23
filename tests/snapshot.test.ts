import { describe, expect, it } from "vitest";

import {
  assertSnapshotMutable,
  ImmutableSnapshotError,
  isSnapshotLocked,
} from "@/lib/student-api/immutability";

describe("snapshot immutability", () => {
  it("treats a missing lock as mutable", () => {
    expect(isSnapshotLocked(null)).toBe(false);
    expect(isSnapshotLocked(undefined)).toBe(false);
    expect(() => assertSnapshotMutable(null, "student-01", "2026-W10")).not.toThrow();
  });

  it("treats any lock timestamp as immutable", () => {
    expect(isSnapshotLocked("2026-03-09T08:05:00.000Z")).toBe(true);
    expect(isSnapshotLocked(new Date("2026-03-09T08:05:00.000Z"))).toBe(true);
  });

  it("refuses to overwrite a locked snapshot", () => {
    expect(() =>
      assertSnapshotMutable("2026-03-09T08:05:00.000Z", "student-01", "2026-W10"),
    ).toThrow(ImmutableSnapshotError);

    try {
      assertSnapshotMutable("2026-03-09T08:05:00.000Z", "student-01", "2026-W10");
    } catch (error) {
      expect(error).toBeInstanceOf(ImmutableSnapshotError);
      expect((error as Error).message).toMatch(/locked and cannot be overwritten/);
      expect((error as Error).message).toMatch(/audit log/);
    }
  });
});
