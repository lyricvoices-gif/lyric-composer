/**
 * app/api/generate/route.ts
 * Authenticated proxy from the Next.js composer to the Cloudflare voice worker.
 *
 * Flow:
 *  1. Auth via Clerk — 401 if no valid session
 *  2. Parse and validate request body
 *  3. Check plan + daily usage limit — 429 if exceeded
 *  4. Validate voiceId + variant against lib/voiceData — 400 if invalid
 *  5. Forward full payload to the Cloudflare worker
 *  6. Stream MP3 response back with worker headers passed through
 *  7. Increment daily usage counter (non-blocking)
 *
 * Required DB table (Neon):
 *   CREATE TABLE generation_usage (
 *     user_id TEXT    NOT NULL,
 *     date    DATE    NOT NULL DEFAULT CURRENT_DATE,
 *     count   INTEGER NOT NULL DEFAULT 0,
 *     PRIMARY KEY (user_id, date)
 *   );
 */

import { auth, clerkClient } from "@clerk/nextjs/server"
import { neon } from "@neondatabase/serverless"
import { getVoice, VoiceId } from "@/lib/voiceData"
import { getPlanConfig, isUnderDailyLimit, remainingGenerations, resolvePlanId } from "@/lib/planConfig"

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
  emotion?: string
}

interface GenerateRequest {
  voiceId: string
  variant: string
  script: string
  direction: Direction
  segments: Segment[]
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
  const { userId, has } = await auth()
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: GenerateRequest
  try {
    body = (await req.json()) as GenerateRequest
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { voiceId, variant, script, direction, segments } = body

  if (!voiceId || !variant || !script) {
    return Response.json(
      { error: "Missing required fields: voiceId, variant, script" },
      { status: 400 }
    )
  }

  // ── 3. Plan + usage check ─────────────────────────────────────────────────
  const plan = getPlanConfig(resolvePlanId(has))

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
    currentUsage = await getDailyUsage(userId)
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
  let workerRes: Response
  try {
    workerRes = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, variant, script, direction, segments }),
    })
  } catch (err) {
    console.error("[generate] Worker fetch failed:", err)
    return Response.json(
      { error: "Failed to reach voice worker" },
      { status: 502 }
    )
  }

  if (!workerRes.ok) {
    const detail = await workerRes.text().catch(() => "(no body)")
    console.error(`[generate] Worker returned ${workerRes.status}:`, detail)
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
  incrementDailyUsage(userId).catch((err) => {
    console.error("[generate] Failed to increment usage for", userId, err)
  })

  // ── 8. Write voice genome event (non-blocking) ────────────────────────────
  const planTier = resolvePlanId(has)
  const genomeEventId = crypto.randomUUID()
  responseHeaders.set("X-Genome-Event-Id", genomeEventId)

  writeGenomeEvent({
    genomeEventId,
    userId,
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
    if (seg.emotion) marks.add(seg.emotion)
  }
  return Array.from(marks)
}

async function writeGenomeEvent(opts: {
  genomeEventId: string
  userId: string
  voiceId: string
  variant: string
  script: string
  direction: Direction
  segments: Segment[]
  planTier: string
  modelId: string | null
}): Promise<void> {
  const { genomeEventId, userId, voiceId, variant, script, direction, segments, planTier, modelId } = opts
  const sql = db()

  // Fetch user's onboarding_intent (use_case)
  let useCase: string | null = null
  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    useCase = (user.publicMetadata?.onboarding_intent as string) ?? null
  } catch {
    // non-fatal
  }

  // Direction marks from segments
  const directionMarksUsed = extractDirectionMarks(segments)
  if (direction?.intent) directionMarksUsed.push(direction.intent)
  const directionMarkCount = segments?.filter((s) => s.emotion).length ?? 0

  // Session position — count of genome events for this user today + 1
  const posRows = await sql`
    SELECT COUNT(*) AS cnt
    FROM voice_genome_events
    WHERE clerk_user_id = ${userId}
      AND created_at >= CURRENT_DATE
  `
  const sessionPosition = Number((posRows[0] as { cnt: string }).cnt) + 1

  // Regenerated — same voice+variant in last 60s
  const regenRows = await sql`
    SELECT 1 FROM voice_genome_events
    WHERE clerk_user_id = ${userId}
      AND voice_id = ${voiceId}
      AND variant = ${variant}
      AND created_at >= NOW() - INTERVAL '60 seconds'
    LIMIT 1
  `
  const regenerated = regenRows.length > 0

  await sql`
    INSERT INTO voice_genome_events (
      id, clerk_user_id, voice_id, variant, use_case,
      script_length, direction_marks_used, direction_mark_count,
      regenerated, session_position, plan_tier,
      emotional_direction, character_count,
      provider, model_id
    ) VALUES (
      ${genomeEventId}::uuid, ${userId}, ${voiceId}, ${variant}, ${useCase},
      ${script.length}, ${directionMarksUsed}, ${directionMarkCount},
      ${regenerated}, ${sessionPosition}, ${planTier},
      ${direction?.intent ?? null}, ${script.length},
      'hume', ${modelId}
    )
  `
}
