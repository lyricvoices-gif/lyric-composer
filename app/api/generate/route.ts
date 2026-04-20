/**
 * app/api/generate/route.ts
 * Authenticated proxy from the Next.js composer to the Cloudflare voice worker.
 *
 * Flow:
 *  1. Auth via Supabase — 401 if no valid session
 *  2. Parse and validate request body
 *  3. Check plan + daily usage limit — 429 if exceeded
 *  4. Validate voiceId + variant against lib/voiceData — 400 if invalid
 *  5. Forward full payload to the Cloudflare worker
 *  6. Stream MP3 response back with worker headers passed through
 *  7. Increment daily usage counter (non-blocking)
 *  8. Write voice genome event (non-blocking)
 */

import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"
import { getVoice, VoiceId } from "@/lib/voiceData"
import { getPlanConfig, isUnderDailyLimit, remainingGenerations, resolvePlanId } from "@/lib/planConfig"
import { insertUserEvent } from "@/lib/events"
import { sendAdminAlert } from "@/lib/alerts"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_URL = "https://lyric-voice-api.sparknfable.workers.dev"

/** Worker response headers to forward back to the client */
const PASSTHROUGH_HEADERS = [
  "X-Generation-Quality",
  "X-Generation-Attempts",
  "X-Voice-Provider",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectionPreset {
  pace: string
  energy: string
  emphasis: string
  affect: string
}

interface Direction {
  mode: "global" | "segment"
  intent: string
  preset?: DirectionPreset
}

interface Segment {
  text: string
  intent?: string
  emotion?: string
  voiceId?: string
  variant?: string
}

interface GenerateRequest {
  voiceId: string
  variant: string
  script: string
  direction: Direction
  segments: Segment[]
  multiVoice?: boolean
}

// ---------------------------------------------------------------------------
// Voice-fidelity acting instructions
// ---------------------------------------------------------------------------

/**
 * Maps bare emotion / intent tokens into Hume-compatible acting instructions
 * that explicitly ask Octave to preserve the original voice's identity while
 * layering the requested emotion *on top*.
 *
 * Best practices from the Hume docs:
 *  - Keep descriptions concise (< 100 chars)
 *  - Use precise emotions + delivery style
 *  - Combine for nuance: emotion + voice-preservation cue
 *
 * When a segment carries one of the voice's variant intents ("Authoritative",
 * "Warm", etc.) no description is added — the variant's humeModelId already
 * embodies that posture.
 */
const EMOTION_DESCRIPTIONS: Record<string, string> = {
  // Per-voice emotions — phrased to preserve voice identity.
  // Each instruction includes "begin speaking immediately" to suppress
  // filler words, breaths, or vocal lead-ins the model sometimes adds.
  calm:           "Calm and steady. Begin speaking immediately, no lead-in.",
  determined:     "Determined and resolute with conviction. Begin speaking immediately.",
  focused:        "Focused and precise. Begin speaking immediately, direct onset.",
  reflective:     "Reflective and thoughtful, gentle introspection. Start speaking immediately.",
  confident:      "Confident and assured. Begin speaking immediately, no hesitation.",
  serene:         "Serene and peaceful with soft warmth. Begin speaking immediately.",
  tender:         "Tender and gentle, warmly intimate. Start the line immediately.",
  hopeful:        "Hopeful and gently uplifted. Begin speaking immediately.",
  empathetic:     "Empathetic and caring with genuine warmth. Start immediately.",
  soothing:       "Soothing and gentle, softly reassuring. Begin speaking immediately.",
  nurturing:      "Nurturing and warm, gently supportive. Start the line immediately.",
  contemplative:  "Contemplative and quietly thoughtful. Begin speaking immediately.",
  grounded:       "Grounded and steady with natural composure. Start immediately.",
  resilient:      "Resilient and quietly strong. Begin speaking immediately.",
  curious:        "Curious and engaged. Begin speaking immediately, no filler.",
  playful:        "Playful and lightly spirited. Start the line immediately.",
  witty:          "Witty and clever, naturally sharp. Begin speaking immediately.",
  bold:           "Bold and energetic with commanding presence. Start immediately.",
  edgy:           "Edgy and raw, intensely authentic. Begin speaking immediately.",
  provocative:    "Provocative and daring. Begin speaking immediately, no lead-in.",
  irreverent:     "Irreverent and casually defiant. Start the line immediately.",
  adventurous:    "Adventurous and spirited with vivid energy. Begin immediately.",
  dramatic:       "Dramatic with measured intensity. Begin speaking immediately.",
  mysterious:     "Mysterious and intriguing, low allure. Start immediately, no preamble.",
  cinematic:      "Cinematic and sweeping with epic presence. Begin speaking immediately.",
  suspenseful:    "Suspenseful and taut with restrained tension. Start immediately, no filler.",
  wistful:        "Wistful and bittersweet, gentle longing. Begin speaking immediately.",
  commanding:     "Commanding and authoritative. Start the line immediately.",
  inspiring:      "Inspiring and uplifting with earnest conviction. Begin immediately.",
  conversational: "Conversational and relaxed. Begin speaking immediately, natural.",
  // Additional per-voice emotions from voiceData palette
  amused:         "Amused and lightly entertained. Begin speaking immediately.",
  awe:            "Awestruck with breathless reverence. Start the line immediately.",
  defiant:        "Defiant and unyielding. Begin speaking immediately, no hesitation.",
  excited:        "Excited and energized with vibrant enthusiasm. Start immediately.",
  melancholic:    "Melancholic and deeply wistful. Begin speaking immediately, no lead-in.",
  proud:          "Proud and quietly dignified. Begin speaking immediately.",
  serious:        "Serious and measured with weighty composure. Start immediately.",
  somber:         "Somber and subdued with grave sincerity. Begin speaking immediately.",
  tense:          "Tense with restrained urgency. Begin speaking immediately, no filler.",
}

/**
 * Enriches raw segments from the composer with voice-preserving
 * acting instructions for the Hume TTS API.
 *
 * The Cloudflare worker uses `seg.intent` directly as the Hume `description`
 * field when the intent doesn’t match a known variant. So we replace bare
 * emotion tokens ("calm", "excited") with richer acting instructions that
 * tell Octave to layer emotion while preserving the original voice identity.
 *
 * Variant intents ("Authoritative", "Warm", etc.) are left untouched — the
 * worker resolves them to a humeModelId, and no description is sent.
 */
function enrichSegments(
  segments: Segment[],
  voiceIntents: string[]
): Segment[] {
  return segments.map((seg) => {
    const token = seg.intent ?? seg.emotion
    if (!token) return seg

    // Variant intents are handled by the humeModelId — leave as-is
    if (voiceIntents.includes(token)) return seg

    // Replace the bare emotion token with a richer acting instruction
    const key = token.toLowerCase()
    const desc =
      EMOTION_DESCRIPTIONS[key] ??
      `${token.toLowerCase()}, natural delivery. Begin speaking immediately, no filler.`

    return { ...seg, intent: desc }
  })
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

async function getDailyUsage(userId: string): Promise<number> {
  const sql = db()
  const rows = await sql`
    SELECT count
    FROM generation_usage
    WHERE user_id = ${userId}
      AND date = CURRENT_DATE
  `
  return (rows[0]?.count as number) ?? 0
}

async function incrementDailyUsage(userId: string): Promise<void> {
  const sql = db()
  await sql`
    INSERT INTO generation_usage (user_id, date, count)
    VALUES (${userId}, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET count = generation_usage.count + 1
  `
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const planTier = resolvePlanId(user.app_metadata?.plan_tier)

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: GenerateRequest
  try {
    body = (await req.json()) as GenerateRequest
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { voiceId, variant, script, direction, segments, multiVoice } = body

  if (!voiceId || !variant || !script) {
    return Response.json(
      { error: "Missing required fields: voiceId, variant, script" },
      { status: 400 }
    )
  }

  // ── 3. Plan + usage check ─────────────────────────────────────────────────
  const plan = getPlanConfig(planTier)

  if (script.length > plan.maxScriptCharacters) {
    return Response.json(
      {
        error: "Script exceeds plan limit",
        limit: plan.maxScriptCharacters,
        received: script.length,
        plan: plan.label,
      },
      { status: 400 }
    )
  }

  let currentUsage: number
  try {
    currentUsage = await getDailyUsage(user.id)
  } catch (err) {
    console.error("[generate] Failed to read usage:", err)
    return Response.json(
      { error: "Internal error reading usage" },
      { status: 500 }
    )
  }

  if (!isUnderDailyLimit(plan, currentUsage)) {
    const remaining = remainingGenerations(plan, currentUsage)
    return Response.json(
      {
        error: "Daily generation limit reached",
        limit: plan.dailyGenerationLimit,
        used: currentUsage,
        remaining: remaining ?? 0,
        plan: plan.label,
        resetsAt: "midnight UTC",
      },
      { status: 429 }
    )
  }

  // ── 4. Validate voiceId + variant ─────────────────────────────────────────
  let voice
  try {
    voice = getVoice(voiceId as VoiceId)
  } catch {
    return Response.json(
      { error: `Unknown voiceId: "${voiceId}"` },
      { status: 400 }
    )
  }

  if (!(variant in voice.variants)) {
    return Response.json(
      {
        error: `Unknown variant "${variant}" for voice "${voiceId}"`,
        validVariants: voice.intents,
      },
      { status: 400 }
    )
  }

  // ── 5. Forward to Cloudflare worker ───────────────────────────────────────
  // Multi-voice: each segment may carry its own voiceId + variant.
  // Enrich segments per their own voice’s intents, and pass per-segment
  // voice info so the worker can resolve the correct Hume model per segment.
  let enrichedSegments: Segment[]
  if (multiVoice && segments?.some((s) => s.voiceId)) {
    // Enrich each segment based on its own voice’s intents
    enrichedSegments = (segments ?? []).map((seg) => {
      const segVoiceId = seg.voiceId ?? voiceId
      let segVoice
      try { segVoice = getVoice(segVoiceId as VoiceId) } catch { segVoice = voice }
      const token = seg.intent ?? seg.emotion
      if (!token) return seg
      if (segVoice.intents.includes(token)) return seg
      const key = token.toLowerCase()
      const desc = EMOTION_DESCRIPTIONS[key] ?? `${token.toLowerCase()}, natural delivery. Begin speaking immediately, no filler.`
      return { ...seg, intent: desc }
    })
  } else {
    enrichedSegments = enrichSegments(segments ?? [], voice.intents)
  }

  let workerRes: Response
  try {
    workerRes = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, variant, script, direction, segments: enrichedSegments, multiVoice: !!multiVoice }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[generate] Worker fetch failed:", err)
    insertUserEvent({
      userId: user.id,
      eventType: "generation_error",
      planTier,
      metadata: { stage: "worker_fetch", voice_id: voiceId, variant, error: message },
    })
    sendAdminAlert({
      subject: "Generation error — worker unreachable",
      body: `Cloudflare worker fetch failed.\n\nUser: ${user.id}\nVoice: ${voiceId} / ${variant}\nError: ${message}`,
      dedupeKey: "generation_error:worker_fetch",
    })
    return Response.json(
      { error: "Failed to reach voice worker" },
      { status: 502 }
    )
  }

  if (!workerRes.ok) {
    const detail = await workerRes.text().catch(() => "(no body)")
    console.error(`[generate] Worker returned ${workerRes.status}:`, detail)
    insertUserEvent({
      userId: user.id,
      eventType: "generation_error",
      planTier,
      metadata: {
        stage: "worker_status",
        worker_status: workerRes.status,
        voice_id: voiceId,
        variant,
        detail: detail.slice(0, 500),
      },
    })
    sendAdminAlert({
      subject: `Generation error — worker ${workerRes.status}`,
      body: [
        `Cloudflare worker returned non-OK status.`,
        ``,
        `User: ${user.id}`,
        `Voice: ${voiceId} / ${variant}`,
        `Status: ${workerRes.status}`,
        `Detail: ${detail.slice(0, 500)}`,
      ].join("\n"),
      dedupeKey: `generation_error:worker_status:${workerRes.status}`,
    })
    return Response.json(
      { error: "Voice worker error", workerStatus: workerRes.status, detail },
      { status: 502 }
    )
  }

  // ── 6. Stream response back with worker headers ───────────────────────────
  const responseHeaders = new Headers()
  responseHeaders.set("Content-Type", "audio/mpeg")

  for (const header of PASSTHROUGH_HEADERS) {
    const val = workerRes.headers.get(header)
    if (val) responseHeaders.set(header, val)
  }

  // ── 7. Increment usage (non-blocking — generation already succeeded) ───────
  incrementDailyUsage(user.id).catch((err) => {
    console.error("[generate] Failed to increment usage for", user.id, err)
  })

  // ── 8. Write voice genome event (non-blocking) ────────────────────────────
  const genomeEventId = crypto.randomUUID()
  responseHeaders.set("X-Genome-Event-Id", genomeEventId)

  writeGenomeEvent({
    genomeEventId,
    userId: user.id,
    onboardingIntent: (user.app_metadata?.onboarding_intent as string) ?? null,
    voiceId,
    variant,
    script,
    direction,
    segments,
    planTier,
    modelId: workerRes.headers.get("X-Model-Id") ?? null,
  }).catch((err) => {
    console.error("[generate] Failed to write genome event:", err)
  })

  return new Response(workerRes.body, {
    status: 200,
    headers: responseHeaders,
  })
}

// ---------------------------------------------------------------------------
// Voice genome helper
// ---------------------------------------------------------------------------

function extractDirectionMarks(segments: Segment[]): string[] {
  const marks = new Set<string>()
  for (const seg of segments ?? []) {
    const token = seg.intent ?? seg.emotion
    if (token) marks.add(token)
  }
  return Array.from(marks)
}

async function writeGenomeEvent(opts: {
  genomeEventId: string
  userId: string
  onboardingIntent: string | null
  voiceId: string
  variant: string
  script: string
  direction: Direction
  segments: Segment[]
  planTier: string
  modelId: string | null
}): Promise<void> {
  const { genomeEventId, userId, onboardingIntent, voiceId, variant, script, direction, segments, planTier, modelId } = opts
  const sql = db()

  // Direction marks from segments
  const directionMarksUsed = extractDirectionMarks(segments)
  if (direction?.intent) directionMarksUsed.push(direction.intent)
  const directionMarkCount = segments?.filter((s) => s.intent ?? s.emotion).length ?? 0

  // Session position — count of genome events for this user today + 1
  const posRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM voice_genome_events
    WHERE user_id = ${userId}
      AND created_at >= CURRENT_DATE
  `
  const sessionPosition = Number((posRows[0] as { cnt: string }).cnt) + 1

  // Regenerated — same voice+variant in last 60s
  const regenRows = await sql`
    SELECT 1 FROM voice_genome_events
    WHERE user_id = ${userId}
      AND voice_id = ${voiceId}
      AND variant = ${variant}
      AND created_at >= NOW() - INTERVAL '60 seconds'
    LIMIT 1
  `
  const regenerated = regenRows.length > 0

  await sql`
    INSERT INTO voice_genome_events (
      id, user_id, voice_id, variant, use_case,
      script_length, direction_marks_used, direction_mark_count,
      regenerated, session_position, plan_tier,
      emotional_direction, character_count,
      provider, model_id
    ) VALUES (
      ${genomeEventId}::uuid, ${userId}, ${voiceId}, ${variant}, ${onboardingIntent},
      ${script.length}, ${directionMarksUsed}, ${directionMarkCount},
      ${regenerated}, ${sessionPosition}, ${planTier},
      ${direction?.intent ?? null}, ${script.length},
      'hume', ${modelId}
    )
  `
}
