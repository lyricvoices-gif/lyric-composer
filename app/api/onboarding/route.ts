/**
 * app/api/onboarding/route.ts
 * Marks the user's onboarding complete and persists their voice/variant choices
 * to Supabase app_metadata. Called from the /onboarding client flow.
 */

import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { neon } from "@neondatabase/serverless"
import { getAllVoices } from "@/lib/voiceData"
import type { VoiceId } from "@/lib/voiceData"

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
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

  // Write to app_metadata (merges with existing — trial_ends_at is preserved)
  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      onboarding_complete: true,
      onboarding_voice: voice,
      onboarding_variant: variant,
      onboarding_intent: intent,
    },
  })

  if (metaError) {
    console.error("[api/onboarding] Failed to update app_metadata:", metaError)
    return Response.json({ error: "Failed to save onboarding" }, { status: 500 })
  }

  // Mirror to user_profiles for analytics / reporting
  try {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`
      UPDATE user_profiles
      SET
        onboarding_complete = true,
        onboarding_voice    = ${voice},
        onboarding_variant  = ${variant},
        onboarding_intent   = ${intent}
      WHERE user_id = ${user.id}
    `
  } catch (err) {
    console.error("[api/onboarding] Failed to mirror to user_profiles:", err)
    // Non-fatal — app_metadata is the source of truth
  }

  return Response.json({ ok: true })
}
