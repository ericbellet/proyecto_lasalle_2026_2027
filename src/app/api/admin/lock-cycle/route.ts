import { authorise, unauthorised } from "@/lib/admin/auth";
import { lockCycle } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";

/**
 * Freezes a cycle. After this the snapshots are the official predictions and
 * a re-fetch of the same student is rejected rather than silently overwriting.
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
      message: `Locked ${result.snapshots} snapshot(s) in ${body.cycleId}.`,
    });
  } catch (error) {
    return failure(error);
  }
}
