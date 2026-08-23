import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

/**
 * Database client.
 *
 * Lazily created so that MOCK_MODE never opens a connection, and cached on
 * `globalThis` so Next's dev-server module reloads do not leak sockets.
 */

declare global {
  var __vicDb: ReturnType<typeof createClient> | undefined;
}

function createClient(connectionString: string) {
  // `prepare: false` keeps this compatible with transaction-mode connection
  // poolers, which is how both Neon and Supabase serve serverless clients.
  const sql = postgres(connectionString, { max: 5, prepare: false });
  return drizzle(sql, { schema });
}

export function db() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Either configure a PostgreSQL connection or run with MOCK_MODE=true.",
    );
  }

  if (!globalThis.__vicDb) globalThis.__vicDb = createClient(connectionString);
  return globalThis.__vicDb;
}

export { schema };
