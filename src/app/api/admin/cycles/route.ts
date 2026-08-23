import { authorise, unauthorised } from "@/lib/admin/auth";
import { createCycle } from "@/lib/admin/operations";
import { failure } from "@/lib/admin/respond";

export const dynamic = "force-dynamic";

/** Creates (or returns) the prediction cycle for a given week. */
export async function POST(request: Request) {
  const auth = authorise(request);
  if (!auth.ok) return unauthorised(auth);

  try {
    const body = (await request.json().catch(() => ({}))) as { date?: string };
    const result = await createCycle(body.date);
    return Response.json({
      ok: true,
      cycleId: result.id,
      message: result.created
        ? `Created cycle ${result.id}.`
        : `Cycle ${result.id} already exists.`,
    });
  } catch (error) {
    return failure(error);
  }
}
