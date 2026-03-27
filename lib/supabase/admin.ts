import { createClient } from "@supabase/supabase-js"

/**
 * Supabase Admin client — uses the service role key, bypasses Row Level Security.
 * Server-side only. Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 *
 * Use for:
 *  - Writing app_metadata (plan, trial, onboarding flags)
 *  - Any admin-level auth operations
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
