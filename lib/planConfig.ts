/**
 * lib/planConfig.ts
 * Plan tier definitions and limit enforcement for Lyric Composer.
 *
 * Plans are resolved from Supabase app_metadata.plan_tier (set server-side only).
 * Falls back to "creator" (lowest paid tier) if no plan is assigned.
 * There is no free tier in the Next.js app — the mini composer on the marketing site handles that.
 *
 * Trial flow:
 * - 7-day free trial, no credit card required
 * - trial_ends_at written to app_metadata + user_profiles by auth/callback on first sign-in
 * - Trial users get Creator-level limits
 * - After trial expires, user is redirected to /upgrade
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanId = "creator" | "studio" | "enterprise"

/**
 * Shape of Supabase app_metadata for Lyric users.
 * Written server-side only via the admin client (never from the client).
 */
export interface UserMetadata {
  /** Active plan tier. Absent during trial. */
  plan_tier?: PlanId
  /** ISO 8601 datetime string. Set at first sign-in. */
  trial_ends_at?: string
  /** True once the user has completed the /onboarding flow. */
  onboarding_complete?: boolean
  /** Voice ID chosen during onboarding (e.g. "morgan-anchor"). */
  onboarding_voice?: string
  /** Variant ID chosen during onboarding (e.g. "anchor"). */
  onboarding_variant?: string
  /** Directional intent chosen during onboarding (e.g. "calm"). */
  onboarding_intent?: string
}

export interface PlanConfig {
  id: PlanId
  label: string
  /**
   * Maximum number of generations allowed per calendar day (UTC).
   * -1 means unlimited.
   */
  dailyGenerationLimit: number
  /**
   * Maximum script length in characters per generation request.
   */
  maxScriptCharacters: number
}

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const plans: Record<PlanId, PlanConfig> = {
  creator: {
    id: "creator",
    label: "Creator",
    dailyGenerationLimit: 25,
    maxScriptCharacters: 500,
  },
  studio: {
    id: "studio",
    label: "Studio",
    dailyGenerationLimit: 100,
    maxScriptCharacters: 2_000,
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    dailyGenerationLimit: -1, // unlimited
    maxScriptCharacters: 10_000,
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the PlanConfig for the given plan ID string.
 * Falls back to "creator" for unknown or missing values.
 */
export function getPlanConfig(planId: string | null | undefined): PlanConfig {
  if (planId && planId in plans) {
    return plans[planId as PlanId]
  }
  return plans.creator
}

/**
 * Returns true if the user is allowed to generate given their current daily usage.
 */
export function isUnderDailyLimit(
  plan: PlanConfig,
  currentDailyUsage: number
): boolean {
  if (plan.dailyGenerationLimit === -1) return true
  return currentDailyUsage < plan.dailyGenerationLimit
}

/**
 * Returns the number of remaining generations today, or null if unlimited.
 */
export function remainingGenerations(
  plan: PlanConfig,
  currentDailyUsage: number
): number | null {
  if (plan.dailyGenerationLimit === -1) return null
  return Math.max(0, plan.dailyGenerationLimit - currentDailyUsage)
}

/**
 * Resolves the active PlanId from the plan_tier string (from app_metadata or DB).
 * Checks tiers in descending order so the highest-entitled plan always wins.
 * Falls back to "creator" if no plan is assigned.
 */
export function resolvePlanId(planTier: string | null | undefined): PlanId {
  if (planTier === "enterprise") return "enterprise"
  if (planTier === "studio") return "studio"
  return "creator"
}

/**
 * Returns true if the user holds any paid plan.
 * Used to gate access to the composer for authenticated-but-unpaid users.
 */
export function hasPaidPlan(planTier: string | null | undefined): boolean {
  return planTier === "enterprise" || planTier === "studio" || planTier === "creator"
}

// ---------------------------------------------------------------------------
// Trial helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the trial period is currently active (not yet expired).
 */
export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) > new Date()
}

/**
 * Returns true if the trial end date has passed.
 */
export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) <= new Date()
}

/**
 * Returns the number of full days remaining in the trial, or 0 if expired/absent.
 */
export function trialDaysRemaining(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Returns true if the user can access the composer:
 * either they have an active paid plan, or they are within their trial window.
 */
export function hasComposerAccess(
  planTier: string | null | undefined,
  trialEndsAt?: string | null
): boolean {
  return hasPaidPlan(planTier) || isTrialActive(trialEndsAt)
}
