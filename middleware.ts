import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { UserMetadata } from "@/lib/planConfig"
import { isTrialActive, hasPaidPlan } from "@/lib/planConfig"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/(.*)",
])

// Routes that authenticated users can access regardless of onboarding/trial state
const isAuthGatedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/upgrade(.*)",
])

export default clerkMiddleware(async (auth, request) => {
  // Always allow public routes through without auth check
  if (isPublicRoute(request)) return

  // Require sign-in for everything else
  const { userId, sessionClaims, has } = await auth.protect()

  if (!userId) return

  const meta = ((sessionClaims?.publicMetadata ?? {}) as UserMetadata)

  // Routes like /onboarding and /upgrade are accessible once signed in —
  // skip the deeper checks so users can always reach them
  if (isAuthGatedRoute(request)) return

  // --- Onboarding gate ---
  // New users (trial or paid) must complete onboarding before accessing the app
  if (!meta.onboarding_complete) {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  // --- Access gate ---
  // After onboarding, user needs either an active paid plan or an active trial
  const canAccess = hasPaidPlan(has) || isTrialActive(meta.trial_ends_at)
  if (!canAccess) {
    // Trial has expired and no paid plan — send to upgrade
    return NextResponse.redirect(new URL("/upgrade", request.url))
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
