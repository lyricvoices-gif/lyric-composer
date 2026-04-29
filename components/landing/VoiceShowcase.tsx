"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getVoice, type VoiceId } from "@/lib/voiceData"
import ScrollReveal from "./ScrollReveal"
import { CREAM, TEXT1, TEXT2, GOLD, display, italic, label } from "./tokens"
import { track } from "./track"

// One row per voice, in landing order. Hex sits before Riven per the brief
// (voiceData.ts has Riven first; landing-only override).
//   - color: signature accent (vertical swatch + waveform when active)
//   - useCase: italic, sentence case, sits inline beside the voice name as
//     the row's secondary descriptor (replaces the previous archetype copy
//     and the separate right-aligned small-caps column)
const ROWS: Array<{
  id: VoiceId
  edition: string
  name: string
  useCase: string
  color: string
}> = [
  { id: "morgan-anchor",   edition: "01", name: "Morgan", useCase: "Enterprise narration",            color: "#d4a78a" },
  { id: "nova-intimist",   edition: "02", name: "Nova",   useCase: "Wellness & coaching",             color: "#a8b89a" },
  { id: "atlas-guide",     edition: "03", name: "Atlas",  useCase: "Product walkthroughs & tutorials", color: "#b5b3a8" },
  { id: "hex-wildcard",    edition: "04", name: "Hex",    useCase: "Creator & commentary",            color: "#b87a5c" },
  { id: "riven-narrator",  edition: "05", name: "Riven",  useCase: "Brand films & documentary",       color: "#9c7c75" },
]

const WAVEFORM_BARS = 60

// Deterministic per-row bar pattern. Same input = same heights every render
// so the waveform doesn't reflow on rerender. Heights are the editorial
// fallback the brief allows in lieu of real waveform extraction.
function buildWaveform(seed: string): number[] {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  const heights: number[] = []
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    const r = (s & 0xffff) / 0xffff
    // Bias towards mid-range with occasional peaks. Avoid bars too short to read.
    const base = 0.32 + r * 0.55
    const peak = i % 11 === (s % 11) ? 0.18 : 0
    heights.push(Math.min(1, base + peak))
  }
  return heights
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "00:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

// Stylized fallback waveforms — deterministic, free, instant. These render
// on first paint while the real waveform decodes in the background, and
// stay forever if decoding fails or the browser lacks Web Audio API.
const STYLIZED_WAVEFORMS: Record<string, number[]> = (() => {
  const map: Record<string, number[]> = {}
  for (const row of ROWS) map[row.id] = buildWaveform(row.id)
  return map
})()

const ROWS_WITH_VOICE = ROWS.map((r) => ({ ...r, voice: getVoice(r.id) }))

// ---------------------------------------------------------------------
// Real waveform decoding via Web Audio API. Module-level cache survives
// remounts so a voice is decoded at most once per page session.
//
// We sample channel-0 amplitude as RMS over fixed-size windows, normalise
// to 0..1, and floor at 0.08 so quiet moments still register visually.
// ---------------------------------------------------------------------
const WAVEFORM_CACHE = new Map<string, number[]>()
const WAVEFORM_PENDING = new Map<string, Promise<number[] | null>>()

async function decodeWaveform(url: string, bars = WAVEFORM_BARS): Promise<number[] | null> {
  if (typeof window === "undefined") return null
  const AC: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null

  const ctx = new AC()
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(buf)
    const data = audioBuf.getChannelData(0)
    const samplesPerBar = Math.max(1, Math.floor(data.length / bars))
    const heights: number[] = []
    let max = 0
    for (let i = 0; i < bars; i++) {
      let sum = 0
      const start = i * samplesPerBar
      const end = Math.min(data.length, start + samplesPerBar)
      const len = end - start
      for (let j = start; j < end; j++) sum += data[j] * data[j]
      const rms = len > 0 ? Math.sqrt(sum / len) : 0
      heights.push(rms)
      if (rms > max) max = rms
    }
    return heights.map((h) => (max > 0 ? Math.max(0.08, h / max) : 0.5))
  } catch {
    return null
  } finally {
    try {
      await ctx.close()
    } catch {
      /* ignore */
    }
  }
}

function getOrDecodeWaveform(voiceId: string, url: string): Promise<number[] | null> {
  if (WAVEFORM_CACHE.has(voiceId)) return Promise.resolve(WAVEFORM_CACHE.get(voiceId)!)
  let pending = WAVEFORM_PENDING.get(voiceId)
  if (!pending) {
    pending = decodeWaveform(url).then((result) => {
      if (result) WAVEFORM_CACHE.set(voiceId, result)
      WAVEFORM_PENDING.delete(voiceId)
      return result
    })
    WAVEFORM_PENDING.set(voiceId, pending)
  }
  return pending
}

export default function VoiceShowcase() {
  const voices = ROWS_WITH_VOICE
  const [activeId, setActiveId] = useState<VoiceId | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durations, setDurations] = useState<Record<string, number>>({})
  // Real per-voice waveforms decoded from the actual audio. Falls back to
  // STYLIZED_WAVEFORMS until decode completes (or forever if it fails).
  const [realWaveforms, setRealWaveforms] = useState<Record<string, number[]>>(() => {
    const seeded: Record<string, number[]> = {}
    for (const id of WAVEFORM_CACHE.keys()) seeded[id] = WAVEFORM_CACHE.get(id)!
    return seeded
  })
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)
  const playStartedAtRef = useRef<number>(0)

  // ---------------------------------------------------------------------
  // Section viewed (fires once on intersect)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const el = sectionRef.current
    if (!el || viewedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          track("voices_section_viewed")
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ---------------------------------------------------------------------
  // Decode each voice's real waveform in the background. The row never
  // blocks on this — STYLIZED_WAVEFORMS renders immediately on first
  // paint and real bars swap in whenever each decode resolves.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    for (const row of ROWS_WITH_VOICE) {
      if (WAVEFORM_CACHE.has(row.id)) continue
      getOrDecodeWaveform(row.id, row.voice.sampleUrl).then((heights) => {
        if (!cancelled && heights) {
          setRealWaveforms((prev) => ({ ...prev, [row.id]: heights }))
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------
  // Pull duration metadata. onLoadedMetadata may fire before React attaches
  // its synthetic-event handler if the response is cached, so we poll the
  // audio elements directly. Two safeguards prevent re-render loops:
  //   - read voice ids from ROWS (module-level constant) so the effect's
  //     deps array is empty and stable
  //   - bail out of the state update entirely if no new duration was
  //     resolved on this tick
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    function readAll() {
      if (cancelled) return
      const next: Record<string, number> = {}
      let pending = 0
      for (const row of ROWS) {
        const a = audioRefs.current[row.id]
        if (a && isFinite(a.duration) && a.duration > 0) next[row.id] = a.duration
        else pending++
      }
      setDurations((prev) => {
        let changed = false
        const merged = { ...prev }
        for (const k in next) {
          if (merged[k] !== next[k]) {
            merged[k] = next[k]
            changed = true
          }
        }
        return changed ? merged : prev
      })
      if (pending > 0) timer = setTimeout(readAll, 250)
    }
    readAll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Pause when the tab is hidden — saves bytes and respects autoplay etiquette.
  useEffect(() => {
    function onVis() {
      if (document.hidden && activeId) {
        const a = audioRefs.current[activeId]
        if (a && !a.paused) a.pause()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [activeId])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((a) => {
        if (a) a.pause()
      })
    }
  }, [])

  // ---------------------------------------------------------------------
  // Playback control. Pressing play on any row:
  //   - same row, currently playing → pause
  //   - same row, paused → resume
  //   - different row → coordinated swap (collapse old, expand new, reset to 0)
  // ---------------------------------------------------------------------
  const togglePlay = useCallback(
    (id: VoiceId) => {
      const targetAudio = audioRefs.current[id]
      if (!targetAudio) return

      if (id === activeId) {
        if (playing) {
          targetAudio.pause()
        } else {
          playStartedAtRef.current = targetAudio.currentTime
          targetAudio
            .play()
            .then(() =>
              track("voice_played", {
                voice_name: id,
                playback_seconds: playStartedAtRef.current,
              })
            )
            .catch(() => setPlaying(false))
        }
        return
      }

      // Different row → swap.
      if (activeId) {
        const prev = audioRefs.current[activeId]
        if (prev) {
          prev.pause()
          prev.currentTime = 0
        }
        track("voice_switched", { from_voice: activeId, to_voice: id })
      }
      setActiveId(id)
      setCurrentTime(0)
      // Wait for React to render the expanded row before starting playback so
      // the visual expand and the audio start coincide.
      requestAnimationFrame(() => {
        targetAudio.currentTime = 0
        targetAudio
          .play()
          .then(() =>
            track("voice_played", {
              voice_name: id,
              playback_seconds: 0,
            })
          )
          .catch(() => setPlaying(false))
      })
    },
    [activeId, playing]
  )

  // ---------------------------------------------------------------------
  // Waveform seek — click anywhere on the bar field jumps the playhead.
  // ---------------------------------------------------------------------
  const onWaveformSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
      if (!activeId) return
      const a = audioRefs.current[activeId]
      const dur = durations[activeId] ?? 0
      if (!a || !dur) return
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const x = ("clientX" in e ? e.clientX : 0) - rect.left
      const pct = Math.max(0, Math.min(1, x / rect.width))
      const next = pct * dur
      a.currentTime = next
      setCurrentTime(next)
      track("waveform_seek", { voice_name: activeId, position: next, duration: dur })
    },
    [activeId, durations]
  )

  // ---------------------------------------------------------------------
  // Keyboard navigation on the row buttons.
  // ---------------------------------------------------------------------
  function onRowKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: VoiceId) {
    const idx = voices.findIndex((v) => v.id === id)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = voices[(idx + 1) % voices.length]
      document.getElementById(`stack-row-${next.id}`)?.focus()
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = voices[(idx - 1 + voices.length) % voices.length]
      document.getElementById(`stack-row-${prev.id}`)?.focus()
      return
    }
    // Seek by 5s when this row is active and expanded.
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && id === activeId) {
      e.preventDefault()
      const a = audioRefs.current[id]
      if (!a) return
      const dur = durations[id] ?? 0
      const delta = e.key === "ArrowRight" ? 5 : -5
      const next = Math.max(0, Math.min(dur, a.currentTime + delta))
      a.currentTime = next
      setCurrentTime(next)
      track("waveform_seek", { voice_name: id, position: next, duration: dur, source: "keyboard" })
    }
  }

  return (
    <div ref={sectionRef} id="voices" style={{ background: CREAM, padding: "clamp(72px, 10vh, 112px) 24px" }}>
      {/* Hidden audio elements — one per voice. preload="metadata" warms
          duration without downloading the full clip. */}
      {voices.map((v) => (
        <audio
          key={v.id}
          ref={(el) => {
            audioRefs.current[v.id] = el
          }}
          src={v.voice.sampleUrl}
          preload="metadata"
          style={{ display: "none" }}
          onTimeUpdate={(e) => {
            if (v.id === activeId) {
              setCurrentTime((e.currentTarget as HTMLAudioElement).currentTime)
            }
          }}
          onPlay={() => {
            if (v.id === activeId) setPlaying(true)
          }}
          onPause={() => {
            if (v.id === activeId) setPlaying(false)
          }}
          onEnded={() => {
            if (v.id === activeId) {
              setPlaying(false)
              setCurrentTime(0)
              track("voice_completed", { voice_name: v.id })
            }
          }}
        />
      ))}

      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        {/* Section header */}
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Edition 01 · The Five</p>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 0 20px",
              lineHeight: 1.0,
              maxWidth: "20ch",
            }}
          >
            Hear what{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>direction</span> sounds like.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <p
            style={{
              fontSize: "16px",
              color: TEXT2,
              lineHeight: 1.6,
              maxWidth: "560px",
              margin: "0 0 56px",
            }}
          >
            Five real voice artists, each performing the work they were built for.
            <br />
            Press play on any voice.
          </p>
        </ScrollReveal>

        {/* The Stack ----------------------------------------------------- */}
        <div
          role="list"
          aria-label="Voices"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {voices.map((v, i) => {
            const expanded = activeId === v.id
            const isFirst = i === 0
            const dur = durations[v.id] ?? 0
            const playPct = expanded && dur > 0 ? Math.min(100, (currentTime / dur) * 100) : 0
            // Real waveform overrides the stylized fallback as soon as decoding completes.
            const bars = realWaveforms[v.id] ?? STYLIZED_WAVEFORMS[v.id]

            return (
              <ScrollReveal key={v.id} delay={i * 80}>
                <div
                  role="listitem"
                  style={{
                    borderTop: isFirst ? "none" : "1px solid rgba(43,42,37,0.15)",
                  }}
                >
                  <button
                    id={`stack-row-${v.id}`}
                    type="button"
                    aria-pressed={expanded && playing}
                    aria-label={`${expanded && playing ? "Pause" : "Play"} ${v.name}, ${v.useCase}`}
                    onClick={() => togglePlay(v.id)}
                    onKeyDown={(e) => onRowKeyDown(e, v.id)}
                    className="stack-row"
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "8px auto auto auto 1fr auto",
                      alignItems: "center",
                      columnGap: "20px",
                      background: "transparent",
                      border: "none",
                      padding: "20px 0",
                      minHeight: "104px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    {/* 1. Color swatch */}
                    <span
                      aria-hidden="true"
                      style={{
                        width: "8px",
                        height: "60px",
                        background: v.color,
                        borderRadius: "1px",
                      }}
                      className="stack-swatch"
                    />

                    {/* 2. Edition number */}
                    <span
                      aria-hidden="true"
                      style={{
                        ...display,
                        fontVariantCaps: "small-caps",
                        fontSize: "14px",
                        color: "rgba(43,42,37,0.5)",
                        letterSpacing: "0.08em",
                      }}
                      className="stack-edition"
                    >
                      {v.edition}
                    </span>

                    {/* 3. Voice name */}
                    <span
                      className="stack-name"
                      style={{
                        ...display,
                        fontSize: "clamp(28px, 3.4vw, 42px)",
                        fontWeight: 400,
                        color: TEXT1,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.0,
                      }}
                    >
                      {v.name}
                    </span>

                    {/* 4. Use case (italic, inline beside the name) */}
                    <span
                      style={{
                        ...display,
                        fontStyle: "italic",
                        fontSize: "clamp(16px, 1.5vw, 19px)",
                        color: "rgba(43,42,37,0.7)",
                        letterSpacing: "0.005em",
                        lineHeight: 1.0,
                      }}
                      className="stack-usecase-inline"
                    >
                      <span aria-hidden="true" style={{ marginRight: "10px", opacity: 0.5 }}>·</span>
                      {v.useCase}
                    </span>

                    {/* 5. Spacer pushes the play button to the right edge. */}
                    <span aria-hidden="true" />

                    {/* 6. Play button */}
                    <span
                      aria-hidden="true"
                      className="stack-play"
                      data-active={expanded && playing}
                      style={{
                        position: "relative",
                        width: "44px",
                        height: "44px",
                        borderRadius: "100px",
                        background: TEXT1,
                        color: GOLD,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {expanded && playing ? (
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                          <rect x="0" y="0" width="3.5" height="14" />
                          <rect x="8.5" y="0" width="3.5" height="14" />
                        </svg>
                      ) : (
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                          <path d="M1 0.5v13l10-6.5z" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {/* Expanded waveform area --------------------------------- */}
                  <div
                    aria-hidden={!expanded}
                    style={{
                      maxHeight: expanded ? "120px" : "0",
                      overflow: "hidden",
                      transition: "max-height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    }}
                  >
                    <div
                      style={{
                        padding: "0 0 24px 28px",
                        display: "flex",
                        alignItems: "stretch",
                        gap: "16px",
                      }}
                    >
                      <div
                        role="slider"
                        aria-label={`${v.name} playback position`}
                        aria-valuemin={0}
                        aria-valuemax={Math.round(dur)}
                        aria-valuenow={Math.round(currentTime)}
                        tabIndex={expanded ? 0 : -1}
                        onClick={onWaveformSeek}
                        className={`stack-waveform${expanded && playing ? " is-playing" : ""}`}
                        style={{
                          flex: 1,
                          height: "80px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer",
                          userSelect: "none",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {bars?.map((h, idx) => {
                          const barPct = (idx + 0.5) / WAVEFORM_BARS * 100
                          const past = barPct <= playPct
                          // Stagger each bar's breathing animation so the row
                          // shimmers organically rather than throbbing as one.
                          // Vary duration slightly per index for more life.
                          const delay = (idx * 73) % 1800
                          const duration = 1500 + (idx % 6) * 180
                          return (
                            <span
                              key={idx}
                              aria-hidden="true"
                              className={`stack-bar ${past ? "is-played" : "is-unplayed"}`}
                              style={
                                {
                                  width: "4px",
                                  flex: "0 0 4px",
                                  height: `${h * 100}%`,
                                  minHeight: "4px",
                                  background: v.color,
                                  borderRadius: "1px",
                                  ["--bar-delay"]: `${delay}ms`,
                                  ["--bar-duration"]: `${duration}ms`,
                                } as React.CSSProperties
                              }
                            />
                          )
                        })}
                      </div>

                      <span
                        style={{
                          ...display,
                          fontVariantCaps: "small-caps",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "12px",
                          color: "rgba(43,42,37,0.7)",
                          letterSpacing: "0.04em",
                          alignSelf: "flex-end",
                          marginBottom: "2px",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatTime(currentTime)} / {formatTime(dur)}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        {/* Closing line */}
        <ScrollReveal delay={voices.length * 80 + 80}>
          <p
            style={{
              fontSize: "15px",
              color: "rgba(43,42,37,0.7)",
              lineHeight: 1.65,
              maxWidth: "640px",
              margin: "64px 0 0",
            }}
          >
            Each voice was performed by a real artist and built for specific work. Broadcast narration.
            <br />
            Brand films. Product walkthroughs. Creator content. Documentary storytelling.
          </p>
        </ScrollReveal>
      </div>
    </div>
  )
}
