/**
 * app/api/onboarding/route.ts
 * Marks the user's onboarding complete and persists their voice/variant choices
 * to Clerk publicMetadata. Called from the /onboarding client flow.
 *
 * Only touches the four onboarding fields — existing metadata (plan, trial_ends_at)
 * is preserved via Clerk's merge behavior on updateUserMetadata.
 */

import { auth, clerkClient } from "@clerk/nextjs/server"
import type { UserMetadata } from "@/lib/planConfig"
import { getAllVoices } from "@/lib/voiceData"
import type { VoiceId } from "@/lib/voiceData"

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { voice: string; variant: string; intent: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { voice, variant, intent } = body

  if (!voice || !variant || !intent) {
    return Response.json(
      { error: "Missing required fields: voice, variant, intent" },
      { status: 400 }
    )
  }

  // Validate voice + variant against canonical data
  const voices = getAllVoices()
  const voiceDef = voices.find((v) => v.id === (voice as VoiceId))
  if (!voiceDef) {
    return Response.json({ error: `Unknown voice: "${voice}"` }, { status: 400 })
  }
  if (!(variant in voiceDef.variants)) {
    return Response.json(
      { error: `Unknown variant "${variant}" for voice "${voice}"` },
      { status: 400 }
    )
  }

  const clerk = await clerkClient()
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      onboarding_complete: true,
      onboarding_voice: voice,
      onboarding_variant: variant,
      onboarding_intent: intent,
    } satisfies Partial<UserMetadata>,
  })

  return Response.json({ ok: true })
}
