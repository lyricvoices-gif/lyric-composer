import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  let body: {
    voiceId?: string
    variant?: string
    script?: string
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

  const { voiceId, variant, script, directions, durationS, title } = body

  const sql = db()
  const rows = await sql`
    UPDATE compositions
    SET
      voice_id    = COALESCE(${voiceId ?? null}, voice_id),
      variant     = COALESCE(${variant ?? null}, variant),
      script      = COALESCE(${script ?? null}, script),
      directions  = COALESCE(${directions ? JSON.stringify(directions) : null}, directions),
      duration_s  = COALESCE(${durationS ?? null}, duration_s),
      title       = COALESCE(${title ?? null}, title)
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id
  `

  if (rows.length === 0) {
    return Response.json({ error: "Composition not found" }, { status: 404 })
  }

  return Response.json(rows[0])
}
