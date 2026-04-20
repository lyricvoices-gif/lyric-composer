/**
 * app/api/session/start/route.ts
 * Records a session_started event for the authenticated user.
 * Called once per browser session (client-side, via SessionPing).
 * Returns 204 for unauth so the client doesn't need to care.
 */

import { createClient } from "@/lib/supabase/server"
import { insertUserEvent } from "@/lib/events"
import { resolvePlanId } from "@/lib/planConfig"

export async function POST(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(null, { status: 204 })

  await insertUserEvent({
    userId: user.id,
    eventType: "session_started",
    planTier: resolvePlanId(user.app_metadata?.plan_tier),
  })

  return new Response(null, { status: 204 })
}
