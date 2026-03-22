/**
 * app/onboarding/page.tsx
 * Server wrapper — checks if onboarding is already done (always-fresh via currentUser)
 * and redirects to /composer if so, bypassing the JWT refresh race condition.
 */

import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import type { UserMetadata } from "@/lib/planConfig"
import OnboardingFlow from "./OnboardingFlow"

export default async function OnboardingPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const meta = (user.publicMetadata ?? {}) as UserMetadata
  if (meta.onboarding_complete) redirect("/composer")

  return <OnboardingFlow />
}
