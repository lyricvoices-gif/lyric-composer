import { auth } from "@clerk/nextjs/server"
import { neon } from "@neondatabase/serverless"
import { resolvePlanId } from "@/lib/planConfig"

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

export async function POST(req: Request): Promise<Response> {
  // Auth — return 204 silently if unauthenticated (analytics should never block)
  const { userId, has } = await auth()
  if (!userId) return new Response(null, { status: 204 })

  let body: {
    eventType: string
    voiceId: string
    voiceVariant?: string
    emotionalDirection?: string
    characterCount?: number
    durationMs?: number
    audioDurationS?: number
    metadata?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  if (!body.eventType || !body.voiceId) return new Response(null, { status: 204 })

  const planTier = resolvePlanId(has)

  try {
    const sql = db()
    await sql`
      INSERT INTO composer_events (
        user_id, event_type, voice_id, voice_variant,
        emotional_direction, character_count, duration_ms, audio_duration_s,
        plan_tier, metadata
      ) VALUES (
        ${userId},
        ${body.eventType},
        ${body.voiceId},
        ${body.voiceVariant ?? null},
        ${body.emotionalDirection ?? null},
        ${body.characterCount ?? null},
        ${body.durationMs ?? null},
        ${body.audioDurationS ?? null},
        ${planTier},
        ${body.metadata ? JSON.stringify(body.metadata) : "{}"}
      )
    `
  } catch (err) {
    console.error("[analytics/track]", err)
  }

  return new Response(null, { status: 204 })
}
