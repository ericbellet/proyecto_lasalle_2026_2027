import { authorise, unauthorised } from "@/lib/admin/auth";
import { createCycle, fetchAllAndStore } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";
/** Sixteen endpoints at up to 8s each, run six at a time. */
export const maxDuration = 60;

/**
 * Pulls every enabled student endpoint into the current cycle.
 *
 * The response lists each student individually — a partial success is the normal
 * outcome on a Sunday evening and the administrator needs to see exactly who
 * failed and why.
 */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const body = (await request.json().catch(() => ({}))) as { cycleId?: string };
    const cycleId = body.cycleId ?? (await createCycle()).id;
    const results = await fetchAllAndStore(cycleId);

    return Response.json({
      ok: true,
      cycleId,
      summary: {
        attempted: results.length,
        stored: results.filter((result) => result.stored).length,
        failed: results.filter((result) => !result.stored).length,
      },
      results: results.map((result) => ({
        studentId: result.studentId,
        url: result.url,
        status: result.status,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        stored: result.stored,
        predictionsStored: result.predictionsStored,
        error: result.storeError ?? result.error,
        issues: result.issues,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
