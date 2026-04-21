import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isTrialActive, hasPaidPlan } from "@/lib/planConfig"

// Paths that never require auth
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/auth/callback", "/api/"]

// Paths that require auth but skip the payment/onboarding gates
const AUTH_GATED_PREFIXES = ["/upgrade", "/onboarding", "/account"]

export async function middleware(request: NextRequest) {
  // Build a mutable response so the Supabase client can refresh the session cookie
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any auth checks
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Always allow public paths and API routes
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return supabaseResponse
  }

  // Require sign-in for everything else — preserve original URL as ?next=
  // so the sign-in/callback flow can return the user to where they were headed
  // (e.g. /account from a trial email link).
  if (!user) {
    const signInUrl = new URL("/sign-in", request.url)
    const nextPath = path + (request.nextUrl.search ?? "")
    if (nextPath && nextPath !== "/" && !nextPath.startsWith("/sign-in")) {
      signInUrl.searchParams.set("next", nextPath)
    }
    return NextResponse.redirect(signInUrl)
  }

  // Upgrade + onboarding are accessible once signed in — no deeper checks
  if (AUTH_GATED_PREFIXES.some((p) => path.startsWith(p))) {
    return supabaseResponse
  }

  // --- Gate order: payment THEN onboarding ---
  const meta = user.app_metadata ?? {}

  // 1. Payment gate — user needs an active paid plan or an active trial
  const canAccess = hasPaidPlan(meta.plan_tier) || isTrialActive(meta.trial_ends_at)
  if (!canAccess) {
    // Determine the reason so the upgrade page can show context
    const hadPlanBefore = meta.plan_tier === "expired" || meta.trial_ends_at
    const reason = hadPlanBefore ? "expired" : "no_plan"
    return NextResponse.redirect(new URL(`/upgrade?reason=${reason}`, request.url))
  }

  // 2. Onboarding gate — user needs to complete voice/variant selection
  if (!meta.onboarding_complete) {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
