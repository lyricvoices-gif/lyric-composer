/**
 * app/api/usage/route.ts
 * Returns the authenticated user's daily generation usage count.
 */

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
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sql = db()
    const rows = await sql`
      SELECT count
      FROM generation_usage
      WHERE user_id = ${user.id}
        AND date = CURRENT_DATE
    `
    const count = (rows[0]?.count as number) ?? 0
    return Response.json({ used: count })
  } catch (err) {
    console.error("[usage] Failed to read usage:", err)
    return Response.json({ used: 0 })
  }
}
