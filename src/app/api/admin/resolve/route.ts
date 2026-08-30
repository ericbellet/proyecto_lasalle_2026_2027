import { authorise, unauthorised } from "@/lib/admin/auth";
import { resolveDuePredictions } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Prices every prediction whose horizon has elapsed.
 *
 * Safe to run repeatedly: already-resolved predictions are skipped, so this can
 * sit behind the weekly Sunday cron without any coordination.
 */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const summary = await resolveDuePredictions();
    return Response.json({
      ok: true,
      summary,
      message: `Checked ${summary.checked}, resolved ${summary.resolved}, of which ${summary.hits} hit the target.`,
    });
  } catch (error) {
    return failure(error);
  }
}
