/**
 * Snapshot lock rules.
 *
 * A locked snapshot is the official prediction for that student and cycle.
 * Nothing overwrites it — not a later fetch, not a student redeploy, not a
 * silent admin save. Corrections go through the audit log.
 */

export class ImmutableSnapshotError extends Error {
  constructor(studentId: string, cycleId: string) {
    super(
      `Snapshot for ${studentId} in ${cycleId} is locked and cannot be overwritten. Record a correction in the audit log instead.`,
    );
    this.name = "ImmutableSnapshotError";
  }
}

export function isSnapshotLocked(lockedAt: Date | string | null | undefined): boolean {
  return lockedAt != null && lockedAt !== "";
}

export function assertSnapshotMutable(
  lockedAt: Date | string | null | undefined,
  studentId: string,
  cycleId: string,
): void {
  if (isSnapshotLocked(lockedAt)) {
    throw new ImmutableSnapshotError(studentId, cycleId);
  }
}
