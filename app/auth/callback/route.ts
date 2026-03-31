/**
 * app/auth/callback/route.ts
 * Exchanges the OAuth code for a Supabase session, creates a user_profiles row
 * for new users, then redirects appropriately.
 *
 * Trial provisioning is handled by Stripe Checkout (card required), not here.
 * New users without a plan/trial are redirected to /upgrade by the middleware.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("[auth/callback] Code exchange failed:", error)
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
  }

  const user = data.user
  const isNewUser = !user.app_metadata?.trial_ends_at && !user.app_metadata?.plan_tier

  if (isNewUser) {
    // Create user_profiles row for new users (no trial yet — that happens via Stripe)
    const email =
      user.email ??
      (user.user_metadata?.email as string | undefined) ??
      ""

    try {
      const sql = neon(process.env.DATABASE_URL!)
      const now = new Date().toISOString()
      await sql`
        INSERT INTO user_profiles
          (user_id, email, trial_started_at, plan_tier)
        VALUES
          (${user.id}, ${email}, ${now}, 'none')
        ON CONFLICT (user_id) DO NOTHING
      `
    } catch (err) {
      console.error("[auth/callback] Failed to write user_profiles:", err)
    }

    // New user → middleware will redirect to /upgrade (pricing page) since no plan/trial
    return NextResponse.redirect(`${origin}/upgrade`)
  }

  // Returning user — route based on their state
  const meta = user.app_metadata ?? {}
  const hasPlan = meta.plan_tier && meta.plan_tier !== "none" && meta.plan_tier !== "expired"
  const hasTrial = meta.trial_ends_at && new Date(meta.trial_ends_at) > new Date()

  if (!hasPlan && !hasTrial) {
    return NextResponse.redirect(`${origin}/upgrade`)
  }

  const destination = meta.onboarding_complete ? "/composer" : "/onboarding"
  return NextResponse.redirect(`${origin}${destination}`)
}
