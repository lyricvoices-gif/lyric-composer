/**
 * lib/planConfig.ts
 * Plan tier definitions and limit enforcement for Lyric Composer.
 *
 * Plans are resolved via Clerk Billing using the has() checker from auth().
 * Falls back to "creator" (lowest paid tier) if no plan is assigned.
 * There is no free tier in the Next.js app — the Framer mini composer handles that.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanId = "creator" | "studio" | "enterprise"

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
