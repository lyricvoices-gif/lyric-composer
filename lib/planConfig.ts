/**
 * lib/planConfig.ts
 * Plan tier definitions and limit enforcement for Lyric Composer.
 *
 * Plans are resolved via Clerk Billing using the has() checker from auth().
 * Falls back to "creator" (lowest paid tier) if no plan is assigned.
 * There is no free tier in the Next.js app — the Framer mini composer handles that.
 *
 * Trial flow:
 * - 7-day trial, credit card required at signup (configured in Clerk Dashboard)
 * - Auto-charges to Creator ($29/mo) at day 7
 * - trial_ends_at written to publicMetadata by the Clerk webhook on user.created
 * - Trial users get Creator-level limits
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanId = "creator" | "studio" | "enterprise"

/**
 * Shape of Clerk publicMetadata for Lyric users.
 * Written server-side only (never from the client).
 */
export interface UserMetadata {
  /** Active Clerk Billing plan ID. Absent during trial. */
  plan?: PlanId
  /** ISO 8601 datetime string. Set at signup, cleared once paid plan activates. */
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
 * Resolves the active PlanId from Clerk Billing using the has() checker.
 * Checks tiers in descending order (enterprise → studio → creator) so the
 * highest-entitled plan always wins.
 * Falls back to "creator" if the user has no plan assigned yet.
 *
 * Server usage:  const { has } = await auth()
 * Client usage:  const { has } = useAuth()
 */
export function resolvePlanId(
  has: (params: { plan: string }) => boolean
): PlanId {
  if (has({ plan: "enterprise" })) return "enterprise"
  if (has({ plan: "studio" })) return "studio"
  if (has({ plan: "creator" })) return "creator"
  return "creator"
}

/**
 * Returns true if the user holds any paid plan.
 * Used to gate access to the composer for authenticated-but-unpaid users.
 */
export function hasPaidPlan(
  has: (params: { plan: string }) => boolean
): boolean {
  return has({ plan: "enterprise" }) || has({ plan: "studio" }) || has({ plan: "creator" })
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
  has: (params: { plan: string }) => boolean,
  trialEndsAt?: string | null
): boolean {
  return hasPaidPlan(has) || isTrialActive(trialEndsAt)
}
