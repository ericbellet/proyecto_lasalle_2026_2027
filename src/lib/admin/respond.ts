import { ImmutableSnapshotError, MockModeError } from "@/lib/admin/operations";

/**
 * Turns an operation error into a response an administrator can act on.
 *
 * Mock mode and a locked snapshot are both expected states rather than bugs, so
 * they get their own status codes and their message is passed through verbatim.
 * Anything else is logged server-side and reported generically.
 */
export function failure(error: unknown): Response {
  if (error instanceof MockModeError) {
    return Response.json({ ok: false, error: error.message, code: "mock_mode" }, { status: 409 });
  }
  if (error instanceof ImmutableSnapshotError) {
    return Response.json({ ok: false, error: error.message, code: "locked" }, { status: 409 });
  }

  console.error("[admin]", error);
  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "internal",
    },
    { status: 500 },
  );
}
