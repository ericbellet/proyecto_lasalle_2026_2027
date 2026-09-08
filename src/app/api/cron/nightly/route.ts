import { authorise, unauthorised } from "@/lib/admin/auth";
import { runNightlyJob } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
 *
 * Schedule in vercel.json: `59 21 * * 0` — Sunday 21:59 UTC, which is
 * 23:59 Europe/Madrid during CEST (minute precision; 23:59:59 is not possible).
 *
 * Each run resolves every pick whose Sunday deadline has arrived (1W / 1M /
 * 3M / 6M) and then pulls + locks the current week's student APIs. Failed
 * endpoints are retried a few times; leftovers stay unlocked for
 * POST /api/admin/retry-failed.
 */
async function handle(request: Request): Promise<Response> {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  if (env.mockMode) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "MOCK_MODE is on — no student endpoints are contacted.",
    });
  }

  try {
    const result = await runNightlyJob();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
