import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return neon(url)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const sql = db()
  const rows = await sql`
    DELETE FROM compositions WHERE id = ${id} AND user_id = ${user.id} RETURNING id
  `
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
