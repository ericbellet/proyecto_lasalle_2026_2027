import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser client (publishable key). Safe to import from Client Components.
 * Competition writes still go through Drizzle + DATABASE_URL on the server.
 */
export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
  }
  return createClient(url, key);
}
