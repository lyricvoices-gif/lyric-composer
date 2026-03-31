/**
 * app/api/provision-user/route.ts
 * Ensures a user_profiles row exists for the authenticated user.
 *
 * Called after OTP verification on sign-in/sign-up pages.
 * Does NOT provision a trial — that happens via Stripe Checkout.
 * This just creates the DB row so the rest of the system can find the user.
 */

import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"

export async function POST(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ""
  const phone = user.phone ?? (user.user_metadata?.phone as string | undefined) ?? ""

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const now = new Date().toISOString()
    await sql`
      INSERT INTO user_profiles
        (user_id, email, trial_started_at, plan_tier)
      VALUES
        (${user.id}, ${email || phone}, ${now}, 'none')
      ON CONFLICT (user_id) DO NOTHING
    `
  } catch (err) {
    console.error("[provision-user] Failed to write user_profiles:", err)
    return Response.json({ error: "Failed to provision user" }, { status: 500 })
  }

  return Response.json({ ok: true })
}
