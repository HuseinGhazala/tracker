import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazily create a Supabase admin client using server-only credentials.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * We intentionally don't create a singleton at import time to avoid
 * throwing during Next.js build when env may be absent.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server env is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

