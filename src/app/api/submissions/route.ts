import { validateStudentPayload } from "@/lib/validation/student-contract";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Push alternative to the pull model.
 *
 * The MVP is pull-based — the professor fetches each endpoint at the deadline —
 * because that keeps the timing of the snapshot under the platform's control
 * rather than the student's. This route exists so the same contract can be
 * submitted directly when an endpoint cannot be exposed publicly.
 *
 * It validates and reports, but does not yet persist: a push submission needs an
 * authentication story per student before it can create an official snapshot,
 * and shipping a write path without it would undermine the integrity guarantee
 * the whole competition rests on.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return Response.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const validated = validateStudentPayload(body);
  if (!validated.ok) {
    return Response.json(
      {
        ok: false,
        error: "Payload does not satisfy the student contract",
        issues: validated.issues,
      },
      { status: 422 },
    );
  }

  return Response.json(
    {
      ok: true,
      accepted: false,
      studentId: validated.payload.student,
      predictions: validated.payload.predictions.length,
      message:
        "Payload is valid. Push submissions are not yet recorded — register your endpoint with the professor and the platform will pull it at the deadline.",
      mockMode: env.mockMode,
    },
    { status: 202 },
  );
}
