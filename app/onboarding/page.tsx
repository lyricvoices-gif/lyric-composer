/**
 * app/onboarding/page.tsx
 * Server wrapper for the onboarding flow.
 *
 * First-time users: shown automatically (middleware redirects here if onboarding_complete is false).
 * Returning users: can revisit via /onboarding?revisit=1 from the composer.
 * If onboarding is already done and no revisit param, redirects to /composer.
 */

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import OnboardingFlow from "./OnboardingFlow"

interface Props {
  searchParams: Promise<{ revisit?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const meta = user.app_metadata ?? {}
  const params = await searchParams
  const isRevisit = params.revisit === "1"

  // If onboarding is done and this isn't a revisit, go straight to the composer
  if (meta.onboarding_complete && !isRevisit) redirect("/composer")

  return <OnboardingFlow isRevisit={isRevisit} />
}
