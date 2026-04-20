/**
 * lib/alerts.ts
 * Admin incident alerts sent via Resend to ALERT_TO.
 *
 * Rate-limited via an in-memory Map (per serverless instance).
 * For a flood (e.g. Hume outage), the first alert goes out and subsequent
 * identical alerts within the window are silently dropped. Good enough for
 * "don't spam my inbox" — not a global dedupe (different Vercel instances
 * dedupe independently).
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   EMAIL_FROM   — e.g. "Lyric <alerts@lyricvoices.ai>"
 *   ALERT_TO     — e.g. "thelyricvoices@gmail.com"
 */

import { Resend } from "resend"

const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

const lastSentAt = new Map<string, number>()

function resend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not set")
  return new Resend(key)
}

function from() {
  return process.env.EMAIL_FROM ?? "Lyric <alerts@lyricvoices.ai>"
}

function to() {
  return process.env.ALERT_TO ?? "thelyricvoices@gmail.com"
}

export interface AdminAlertParams {
  subject: string
  body: string
  dedupeKey?: string
  dedupeWindowMs?: number
}

/** Fire-and-forget admin alert. Never throws. */
export async function sendAdminAlert(params: AdminAlertParams): Promise<void> {
  const { subject, body, dedupeKey, dedupeWindowMs = DEFAULT_DEDUPE_WINDOW_MS } = params

  if (dedupeKey) {
    const last = lastSentAt.get(dedupeKey)
    if (last && Date.now() - last < dedupeWindowMs) return
    lastSentAt.set(dedupeKey, Date.now())
  }

  try {
    await resend().emails.send({
      from: from(),
      to: to(),
      subject: `[Lyric alert] ${subject}`,
      text: body,
    })
  } catch (err) {
    console.error("[alerts] Failed to send admin alert:", err)
  }
}
