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

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // ── Save last-used voice (called from composer after generation) ───────
  if (body.action === "save_last_voice") {
    const { voiceId, intent } = body
    if (!voiceId) return Response.json({ error: "Missing voiceId" }, { status: 400 })

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { last_voice: voiceId, last_intent: intent ?? null },
    })
    if (error) {
      console.error("[api/onboarding] Failed to save last voice:", error)
      return Response.json({ error: "Failed to save" }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  // ── Complete onboarding ────────────────────────────────────────────────
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
