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
  | "built_with_section_viewed"
  | "linkedin_clicked"

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
