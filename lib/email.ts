/**
 * lib/email.ts
 * Resend client and typed send helpers for Lyric transactional emails.
 *
 * Day 1, Day 5, and Day 6 emails are all scheduled at signup time using
 * Resend's scheduledAt feature — no cron needed.
 *
 * Required env vars:
 *   RESEND_API_KEY  — from Resend dashboard
 *   EMAIL_FROM      — verified sender, e.g. "Lyric <noreply@lyricvoices.ai>"
 */

import { Resend } from "resend"
import { render } from "@react-email/components"
import TrialWelcome from "@/emails/TrialWelcome"
import TrialNudge from "@/emails/TrialNudge"
import TrialConversion from "@/emails/TrialConversion"

function resend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not set")
  return new Resend(key)
}

function from() {
  return process.env.EMAIL_FROM ?? "Lyric <noreply@lyricvoices.ai>"
}

/** Formats a Date as "Monday, June 9" for use in email copy. */
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Day 1 — Welcome (sent immediately at signup)
// ---------------------------------------------------------------------------

export async function sendTrialWelcome(params: {
  to: string
  firstName?: string
  trialEndsAt: Date
}) {
  const html = await render(
    TrialWelcome({
      firstName: params.firstName,
      trialEndsAt: formatDate(params.trialEndsAt),
    })
  )

  return resend().emails.send({
    from: from(),
    to: params.to,
    subject: "Your Lyric trial is live",
    html,
  })
}

// ---------------------------------------------------------------------------
// Day 5 — Nudge (scheduled 5 days after signup = 2 days before trial ends)
// ---------------------------------------------------------------------------

export async function scheduleTrialNudge(params: {
  to: string
  firstName?: string
  trialEndsAt: Date
}) {
  const sendAt = new Date(params.trialEndsAt)
  sendAt.setDate(sendAt.getDate() - 2) // 2 days before trial ends = Day 5

  const html = await render(TrialNudge({ firstName: params.firstName }))

  return resend().emails.send({
    from: from(),
    to: params.to,
    subject: "2 days left in your Lyric trial",
    html,
    scheduledAt: sendAt.toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Day 6 — Conversion warning (scheduled 1 day before trial ends)
// ---------------------------------------------------------------------------

export async function scheduleTrialConversion(params: {
  to: string
  firstName?: string
  trialEndsAt: Date
}) {
  const sendAt = new Date(params.trialEndsAt)
  sendAt.setDate(sendAt.getDate() - 1) // 1 day before trial ends = Day 6

  const html = await render(TrialConversion({ firstName: params.firstName }))

  return resend().emails.send({
    from: from(),
    to: params.to,
    subject: "Your Lyric trial ends tomorrow",
    html,
    scheduledAt: sendAt.toISOString(),
  })
}
