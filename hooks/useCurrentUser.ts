"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PlanId } from "@/lib/planConfig"

interface CurrentUser {
  userId: string | null
  plan: PlanId | null
  trialEndsAt: string | null
  paymentFailed: boolean
  onboardingVoice: string | null
  onboardingIntent: string | null
  lastVoice: string | null
  lastIntent: string | null
  isLoaded: boolean
}

/**
 * Client-side hook for auth state and plan info.
 * Reads plan + trial from Supabase app_metadata (JWT — no extra DB call).
 * Replaces Clerk's useAuth() + has() pattern.
 */
export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    userId: null,
    plan: null,
    trialEndsAt: null,
    paymentFailed: false,
    onboardingVoice: null,
    onboardingIntent: null,
    lastVoice: null,
    lastIntent: null,
    isLoaded: false,
  })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState({ userId: null, plan: null, trialEndsAt: null, paymentFailed: false, onboardingVoice: null, onboardingIntent: null, lastVoice: null, lastIntent: null, isLoaded: true })
        return
      }
      const meta = user.app_metadata ?? {}
      setState({
        userId: user.id,
        plan: (meta.plan_tier as PlanId) ?? null,
        trialEndsAt: (meta.trial_ends_at as string) ?? null,
        paymentFailed: (meta.payment_failed as boolean) ?? false,
        onboardingVoice: (meta.onboarding_voice as string) ?? null,
        onboardingIntent: (meta.onboarding_intent as string) ?? null,
        lastVoice: (meta.last_voice as string) ?? null,
        lastIntent: (meta.last_intent as string) ?? null,
        isLoaded: true,
      })
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
