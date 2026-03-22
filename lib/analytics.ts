/**
 * lib/analytics.ts
 * Client-side analytics helper for the Composer.
 * Fire-and-forget — never throws, never blocks the UI.
 */

export interface TrackPayload {
  voiceId: string
  voiceVariant?: string
  emotionalDirection?: string
  characterCount?: number
  durationMs?: number
  audioDurationS?: number
  genomeEventId?: string
  metadata?: Record<string, unknown>
}

function post(eventType: "generation" | "download" | "preview", payload: TrackPayload): void {
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, ...payload }),
  }).catch(() => {})
}

export function trackGeneration(payload: TrackPayload): void {
  post("generation", payload)
}

export function trackDownload(payload: TrackPayload): void {
  post("download", payload)
}

export function trackPreview(payload: TrackPayload): void {
  post("preview", payload)
}
