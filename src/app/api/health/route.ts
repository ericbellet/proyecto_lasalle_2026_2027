import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  return url.match(/@([^:/]+)/)?.[1] ?? null;
}

function portOf(url: string | null): string | null {
  if (!url) return null;
  return url.match(/:(\d+)\/postgres/)?.[1] ?? null;
}

export async function GET() {
  const started = Date.now();
  const databaseUrl = env.databaseUrl;
  let db: "ok" | "skipped" | "error" = "skipped";
  let dbError: string | null = null;

  if (databaseUrl && !env.mockMode) {
    try {
      const { db: client } = await import("@/db");
      const { sql } = await import("drizzle-orm");
      await client().execute(sql`select 1`);
      db = "ok";
    } catch (error) {
      db = "error";
      dbError = String(error instanceof Error ? error.message : error).slice(0, 140);
    }
  }

  return Response.json({
    mockMode: env.mockMode,
    hasDatabaseUrl: Boolean(databaseUrl),
    databaseHost: hostOf(databaseUrl),
    databasePort: portOf(databaseUrl),
    marketDataProvider: env.marketDataProvider,
    db,
    dbError,
    ms: Date.now() - started,
  });
}
