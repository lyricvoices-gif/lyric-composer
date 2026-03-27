/**
 * app/auth/callback/route.ts
 * Exchanges the OAuth code for a Supabase session, sets up the trial for new users,
 * then redirects to /onboarding (new) or /composer (returning).
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { neon } from "@neondatabase/serverless"
import {
  sendTrialWelcome,
  scheduleTrialNudge,
  scheduleTrialConversion,
} from "@/lib/email"

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/onboarding"

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
  const isNewUser = !user.app_metadata?.trial_ends_at

  if (isNewUser) {
    // --- New user: set trial + write DB profile ---
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)
    const trialEndsAtISO = trialEndsAt.toISOString()

    const email =
      user.email ??
      (user.user_metadata?.email as string | undefined) ??
      ""

    const firstName =
      (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
      (user.user_metadata?.name as string | undefined)?.split(" ")[0] ??
      undefined

    // Write trial info to app_metadata (available in JWT, no DB call needed in middleware)
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { trial_ends_at: trialEndsAtISO },
      })
    } catch (err) {
      console.error("[auth/callback] Failed to set app_metadata trial:", err)
    }

    // Write user_profiles row
    try {
      const sql = neon(process.env.DATABASE_URL!)
      const now = new Date().toISOString()
      await sql`
        INSERT INTO user_profiles
          (user_id, email, trial_started_at, trial_ends_at, plan_tier)
        VALUES
          (${user.id}, ${email}, ${now}, ${trialEndsAtISO}, 'trial')
        ON CONFLICT (user_id) DO NOTHING
      `
    } catch (err) {
      console.error("[auth/callback] Failed to write user_profiles:", err)
    }

    // Schedule all 3 trial emails (fire-and-forget)
    const emailParams = { to: email, firstName, trialEndsAt }
    Promise.allSettled([
      sendTrialWelcome(emailParams),
      scheduleTrialNudge(emailParams),
      scheduleTrialConversion(emailParams),
    ]).then((results) => {
      results.forEach((r, i) => {
        const label = ["welcome", "nudge", "conversion"][i]
        if (r.status === "rejected") {
          console.error(`[auth/callback] Failed to send/schedule ${label} email:`, r.reason)
        }
      })
    })

    return NextResponse.redirect(`${origin}/onboarding`)
  }

  // Returning user — go to the intended destination or composer
  const onboardingComplete = user.app_metadata?.onboarding_complete
  const destination = onboardingComplete ? "/composer" : "/onboarding"
  return NextResponse.redirect(`${origin}${next !== "/onboarding" ? next : destination}`)
}
