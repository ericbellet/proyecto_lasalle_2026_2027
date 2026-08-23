import { authorise, unauthorised } from "@/lib/admin/auth";
import { recalculateLeaderboard } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stores a leaderboard snapshot for a cycle.
 *
 * The live board is always derived on read; this only writes the historical
 * record used to answer "what did the standings look like that week".
 */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const body = (await request.json().catch(() => ({}))) as { cycleId?: string };
    if (!body.cycleId) {
      return Response.json({ ok: false, error: "cycleId is required" }, { status: 400 });
    }

    const result = await recalculateLeaderboard(body.cycleId);
    return Response.json({
      ok: true,
      message: `Stored standings for ${result.students} student(s) at ${body.cycleId}.`,
    });
  } catch (error) {
    return failure(error);
  }
}
