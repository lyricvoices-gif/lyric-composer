/**
 * app/onboarding/page.tsx
 * Server wrapper — checks if onboarding is already done and redirects
 * to /composer if so, bypassing the JWT refresh race condition.
 */

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import OnboardingFlow from "./OnboardingFlow"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const meta = user.app_metadata ?? {}
  if (meta.onboarding_complete) redirect("/composer")

  return <OnboardingFlow />
}
