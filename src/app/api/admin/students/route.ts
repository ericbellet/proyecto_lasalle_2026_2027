import { authorise, unauthorised } from "@/lib/admin/auth";
import { getRosterStatus, MockModeError } from "@/lib/admin/operations";
import { upsertStudentEndpoint } from "@/lib/admin/roster";
import { failure } from "@/lib/admin/respond";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function requireLive() {
  if (env.mockMode) throw new MockModeError("Registering a student endpoint");
}

/**
 * GET: list registered endpoints and who is still missing a locked snapshot
 * in the current ISO week.
 *
 * POST: professor registers or updates a student's predictions URL.
 */
export async function GET(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    requireLive();
    const status = await getRosterStatus();
    return Response.json({ ok: true, ...status });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    requireLive();
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      handle?: string;
      url?: string;
      enabled?: boolean;
      apiKeyEnvVar?: string | null;
    };

    const student = await upsertStudentEndpoint({
      id: body.id ?? "",
      name: body.name ?? "",
      handle: body.handle ?? body.name ?? "",
      url: body.url ?? "",
      enabled: body.enabled,
      apiKeyEnvVar: body.apiKeyEnvVar,
    });

    return Response.json({ ok: true, student });
  } catch (error) {
    return failure(error);
  }
}
