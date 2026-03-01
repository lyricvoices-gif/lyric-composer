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

import { currentUser } from "@clerk/nextjs/server"
import { neon } from "@neondatabase/serverless"
import { getVoice, VoiceId } from "@/lib/voiceData"
import { getPlanConfig, isUnderDailyLimit, remainingGenerations } from "@/lib/planConfig"

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
  preset: DirectionPreset
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
  const user = await currentUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = user.id
  const planId = user.publicMetadata?.plan as string | undefined

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
  const plan = getPlanConfig(planId)

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

  return new Response(workerRes.body, {
    status: 200,
    headers: responseHeaders,
  })
}
