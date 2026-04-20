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
