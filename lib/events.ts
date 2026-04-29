/**
 * lib/events.ts
 * Server-side helper for inserting rows into user_events.
 * Fire-and-forget: never throws, never blocks.
 */

import { neon } from "@neondatabase/serverless"

export type UserEventType =
  | "session_started"
  | "checkout_started"
  | "checkout_completed"
  | "onboarding_step"
  | "onboarding_completed"
  | "generation_error"
  | "payment_failed"
  | "subscription_cancelled"
  | "landing_page_view"
  | "landing_section_visible"
  | "landing_audio_play"
  | "landing_video_play"
  | "landing_cta_click"
  | "landing_signup_start"
  | "voices_section_viewed"
  | "voice_played"
  | "voice_switched"
  | "voice_completed"
  | "waveform_seek"
  | "transcript_opened"
  | "what_youll_make_viewed"
  | "video_played"
  | "video_completed"
  | "what_youll_make_cta_clicked"
  | "wedge_section_viewed"
  | "wedge_cta_clicked"
  | "pricing_section_viewed"
  | "pricing_card_hovered"
  | "pricing_cta_clicked"
  | "annual_toggled"
  | "pricing_link_clicked"

export interface UserEventInput {
  userId: string | null
  eventType: UserEventType
  planTier?: string | null
  metadata?: Record<string, unknown>
}

export async function insertUserEvent(input: UserEventInput): Promise<void> {
  try {
    const url = process.env.DATABASE_URL
    if (!url) return
    const sql = neon(url)
    await sql`
      INSERT INTO user_events (user_id, event_type, plan_tier, metadata)
      VALUES (
        ${input.userId ?? null},
        ${input.eventType},
        ${input.planTier ?? null},
        ${input.metadata ? JSON.stringify(input.metadata) : "{}"}
      )
    `
  } catch (err) {
    console.error("[events] insertUserEvent failed:", err)
  }
}
