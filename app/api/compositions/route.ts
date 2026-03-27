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
  const rows = await sql`
    SELECT id, created_at, voice_id, variant, script, directions, audio_url, duration_s, title
    FROM compositions
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return Response.json(rows)
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
