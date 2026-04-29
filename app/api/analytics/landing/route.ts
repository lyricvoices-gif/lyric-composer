/**
 * Public landing-page analytics endpoint.
 * Records funnel events to user_events with userId=null (visitors are anonymous
 * by definition — anyone authed gets redirected to /composer before seeing the page).
 *
 * Fire-and-forget: never throws, always returns 204.
 */

import { NextRequest, NextResponse } from "next/server"
import { insertUserEvent, type UserEventType } from "@/lib/events"

const ALLOWED_EVENTS: UserEventType[] = [
  "landing_page_view",
  "landing_section_visible",
  "landing_audio_play",
  "landing_video_play",
  "landing_cta_click",
  "landing_signup_start",
  "voices_section_viewed",
  "voice_played",
  "voice_switched",
  "voice_completed",
  "waveform_seek",
  "transcript_opened",
  "what_youll_make_viewed",
  "video_played",
  "video_completed",
  "what_youll_make_cta_clicked",
  "wedge_section_viewed",
  "wedge_cta_clicked",
  "pricing_section_viewed",
  "pricing_card_hovered",
  "pricing_cta_clicked",
  "annual_toggled",
  "pricing_link_clicked",
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const event = typeof body?.event === "string" ? (body.event as UserEventType) : null
    if (!event || !ALLOWED_EVENTS.includes(event)) {
      return new NextResponse(null, { status: 204 })
    }

    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {}

    // Capture coarse request signal for funnel slicing without storing IP/PII.
    const referer = req.headers.get("referer")
    const ua = req.headers.get("user-agent")

    void insertUserEvent({
      userId: null,
      eventType: event,
      metadata: { ...metadata, referer, ua },
    })
  } catch {
    // swallow
  }
  return new NextResponse(null, { status: 204 })
}

// Allow sendBeacon (which sends as POST with text/plain in some browsers).
export const runtime = "nodejs"
