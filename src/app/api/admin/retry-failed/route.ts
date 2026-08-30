import { authorise, unauthorised } from "@/lib/admin/auth";
import { retryFailedStudents } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Re-fetches students who still have no locked snapshot in the current cycle.
 *
 * Already-locked classmates are not touched. Use this when Sunday's pull
 * stored 15/16 and one endpoint was down — waiting until next Sunday is too
 * late for that student's 1W picks.
 */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const body = (await request.json().catch(() => ({}))) as { cycleId?: string };
    const result = await retryFailedStudents(body.cycleId);

    return Response.json({
      ok: true,
      cycleId: result.cycleId,
      attempted: result.attempted,
      pendingStudentIds: result.lock.pendingStudentIds,
      complete: result.lock.complete,
      summary: {
        attempted: result.results.length,
        stored: result.results.filter((row) => row.stored).length,
        failed: result.results.filter((row) => !row.stored).length,
      },
      results: result.results.map((row) => ({
        studentId: row.studentId,
        url: row.url,
        status: row.status,
        stored: row.stored,
        error: row.storeError ?? row.error,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
