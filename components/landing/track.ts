"use client"

/**
 * Client-side analytics helper for the landing page.
 * Posts to /api/analytics/landing — fire-and-forget, never throws.
 */

export type LandingEvent =
  | "landing_page_view"
  | "landing_section_visible"
  | "landing_audio_play"
  | "landing_video_play"
  | "landing_cta_click"
  | "landing_signup_start"

export function track(event: LandingEvent, metadata?: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({ event, metadata: metadata ?? {} })
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/landing", new Blob([body], { type: "application/json" }))
      return
    }
    fetch("/api/analytics/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // swallow
  }
}
