import { authorise, unauthorised } from "@/lib/admin/auth";
import { lockCycle } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";

/**
 * Freezes snapshots that already exist. Students with no snapshot stay
 * retryable; already-locked rows are not rewritten.
 */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const body = (await request.json().catch(() => ({}))) as { cycleId?: string };
    if (!body.cycleId) {
      return Response.json({ ok: false, error: "cycleId is required" }, { status: 400 });
    }

    const result = await lockCycle(body.cycleId);
    return Response.json({
      ok: true,
      cycleId: body.cycleId,
      pendingStudentIds: result.pendingStudentIds,
      complete: result.complete,
      message: result.complete
        ? `Locked ${result.snapshots} snapshot(s) in ${body.cycleId}.`
        : `Locked ${result.snapshots} snapshot(s) in ${body.cycleId}. Still waiting on: ${result.pendingStudentIds.join(", ") || "none"}.`,
    });
  } catch (error) {
    return failure(error);
  }
}
