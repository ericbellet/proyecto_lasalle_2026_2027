import { authorise, unauthorised } from "@/lib/admin/auth";
import { createCycle, fetchAndStore } from "@/lib/admin/operations";
import { findStudent } from "@/lib/admin/roster";
import { failure } from "@/lib/admin/respond";
import { fetchStudentWithRetry } from "@/lib/student-api/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Fetches one student.
 *
 * `?dryRun=true` validates the endpoint without recording anything, which is how
 * a student verifies their integration before the deadline.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  const { id } = await params;
  const student = await findStudent(id);
  if (!student) {
    return Response.json(
      { ok: false, error: `No student registered with id "${id}". Add the endpoint on /integrate.` },
      { status: 404 },
    );
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  try {
    if (dryRun) {
      const outcome = await fetchStudentWithRetry(student);
      return Response.json({ ok: outcome.status === "healthy", dryRun: true, outcome });
    }

    const body = (await request.json().catch(() => ({}))) as { cycleId?: string };
    const cycleId = body.cycleId ?? (await createCycle()).id;
    const result = await fetchAndStore(student, cycleId);

    return Response.json({ ok: result.stored, cycleId, result });
  } catch (error) {
    return failure(error);
  }
}
