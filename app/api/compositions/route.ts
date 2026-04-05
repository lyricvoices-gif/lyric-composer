import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sql = db()

  // Clean up duplicate rows first — keep only the most recent per normalized script
  await sql`
    DELETE FROM compositions
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, TRIM(BOTH FROM script)
                 ORDER BY created_at DESC
               ) AS rn
        FROM compositions
        WHERE user_id = ${user.id}
      ) ranked
      WHERE rn > 1
    )
  `

  const rows = await sql`
    SELECT DISTINCT ON (TRIM(BOTH FROM script))
      id, created_at, voice_id, variant, script, directions, audio_url, duration_s, title
    FROM compositions
    WHERE user_id = ${user.id}
    ORDER BY TRIM(BOTH FROM script), created_at DESC
  `
  // Re-sort by created_at DESC after deduplication
  rows.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  )
  return Response.json(rows.slice(0, 50))
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    voiceId: string
    variant: string
    script: string
    directions?: unknown
    audioUrl?: string
    durationS?: number
    title?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { voiceId, variant, script, directions, audioUrl, durationS, title } = body
  if (!voiceId || !variant || !script) {
    return Response.json({ error: "Missing required fields: voiceId, variant, script" }, { status: 400 })
  }

  const sql = db()

  // Check if a composition with the same script already exists for this user
  // Normalize whitespace for comparison to avoid near-duplicates
  const existing = await sql`
    SELECT id FROM compositions
    WHERE user_id = ${user.id} AND TRIM(BOTH FROM script) = TRIM(BOTH FROM ${script})
    ORDER BY created_at DESC
    LIMIT 1
  `

  if (existing.length > 0) {
    // Update the existing composition instead of creating a duplicate
    const existingId = existing[0].id
    await sql`
      UPDATE compositions
      SET voice_id   = ${voiceId},
          variant    = ${variant},
          directions = ${directions ? JSON.stringify(directions) : null},
          duration_s = ${durationS ?? null},
          title      = ${title ?? null}
      WHERE id = ${existingId} AND user_id = ${user.id}
    `
    return Response.json({ id: existingId, created_at: null, updated: true }, { status: 200 })
  }

  const rows = await sql`
    INSERT INTO compositions (user_id, voice_id, variant, script, directions, audio_url, duration_s, title)
    VALUES (
      ${user.id}, ${voiceId}, ${variant}, ${script},
      ${directions ? JSON.stringify(directions) : null},
      ${audioUrl ?? null}, ${durationS ?? null}, ${title ?? null}
    )
    RETURNING id, created_at
  `
  return Response.json(rows[0], { status: 201 })
}
