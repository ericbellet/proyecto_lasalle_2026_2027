import "server-only";

import { env } from "@/lib/env";

/**
 * Admin authorisation.
 *
 * One shared bearer token, checked on every mutating route. This is a course
 * platform with one administrator; a session layer and a user table would be
 * more machinery than the threat model justifies, and the token never reaches
 * the browser because the admin UI posts from the server.
 *
 * When `ADMIN_TOKEN` is unset the routes refuse to run rather than defaulting
 * open — an unconfigured deployment must not be a public write endpoint.
 */
export type AuthResult = { ok: true } | { ok: false; status: 401 | 503; message: string };

export function authorise(request: Request): AuthResult {
  if (!env.adminToken) {
    return {
      ok: false,
      status: 503,
      message:
        "ADMIN_TOKEN is not configured. Set it in the environment before using the admin routes.",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!provided || !timingSafeEqual(provided, env.adminToken)) {
    return { ok: false, status: 401, message: "Invalid or missing admin token." };
  }

  return { ok: true };
}

/** Constant-time comparison so the token cannot be recovered byte by byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function unauthorised(result: Extract<AuthResult, { ok: false }>): Response {
  return Response.json({ ok: false, error: result.message }, { status: result.status });
}
