import { createBrowserClient } from "@supabase/ssr"

/**
 * Client-side Supabase client for use in "use client" components.
 * Call once per component; safe to call on every render (memoised internally).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
