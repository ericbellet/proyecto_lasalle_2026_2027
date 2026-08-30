import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Server-side Supabase client (service role). Never import this from a
 * Client Component — it can write past RLS.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
