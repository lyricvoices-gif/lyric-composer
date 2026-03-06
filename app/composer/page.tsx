"use client"

import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { getAllVoices, VoiceDefinition } from "@/lib/voiceData"
import { getPlanConfig, remainingGenerations, resolvePlanId, hasPaidPlan } from "@/lib/planConfig"

const FRAMER_URL = "https://formal-organization-793965.framer.app"

const INLINE_ACTING_DIRECTIONS = [
  "Conversational", "Intimate", "Warm", "Urgent", "Reassuring",
  "Emphasis", "Pause", "Soft", "Confident", "Playful",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InlineMark {
  id: string
  start: number
  end: number
  direction: string
}

interface Paragraph {
  id: string
  text: string
  direction: string
  marks: InlineMark[]
}

interface Composition {
  id: string
  created_at: string
  voice_id: string
  variant: string
  script: string
  directions: Paragraph[] | null
  audio_url: string | null
  duration_s: number | null
  title: string | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
}

function buildMarkedHTML(text: string, marks: InlineMark[]): string {
  if (!marks.length) return escapeHtml(text)
  const sorted = [...marks].sort((a, b) => a.start - b.start)
  let result = ""
  let cursor = 0
  for (const mark of sorted) {
    if (mark.start > cursor) result += escapeHtml(text.slice(cursor, mark.start))
    result += `<span data-mark-id="${mark.id}" data-mark-direction="${mark.direction}" style="background:rgba(196,151,127,0.15);border-radius:3px;padding:1px 0;">${escapeHtml(text.slice(mark.start, mark.end))}</span>`
    cursor = mark.end
  }
  if (cursor < text.length) result += escapeHtml(text.slice(cursor))
  return result
}

function getSelectionCharOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (range.collapsed) return null
  if (!el.contains(range.commonAncestorContainer)) return null

  const preRange = document.createRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length

  const endRange = document.createRange()
  endRange.selectNodeContents(el)
  endRange.setEnd(range.endContainer, range.endOffset)
  const end = endRange.toString().length

  if (start === end) return null
  return { start, end }
}

function getDirectionOptions(voiceIntents: string[]): string[] {
  const extra = INLINE_ACTING_DIRECTIONS.filter((d) => !voiceIntents.includes(d))
  return [...voiceIntents, ...extra]
}

function assembleSegments(paragraphs: Paragraph[]): Array<{ text: string; intent: string }> {
  const segments: Array<{ text: string; intent: string }> = []
  for (const para of paragraphs) {
    if (!para.text.trim()) continue
    if (!para.marks.length) {
      segments.push({ text: para.text, intent: para.direction })
      continue
    }
    const sorted = [...para.marks].sort((a, b) => a.start - b.start)
    let cursor = 0
    for (const mark of sorted) {
      if (mark.start > cursor) {
        const chunk = para.text.slice(cursor, mark.start)
        if (chunk.trim()) segments.push({ text: chunk, intent: para.direction })
      }
      const marked = para.text.slice(mark.start, mark.end)
      if (marked.trim()) segments.push({ text: marked, intent: mark.direction })
      cursor = mark.end
    }
    if (cursor < para.text.length) {
      const tail = para.text.slice(cursor)
      if (tail.trim()) segments.push({ text: tail, intent: para.direction })
    }
  }
  return segments
}

// ---------------------------------------------------------------------------
// Page — Clerk gate
// ---------------------------------------------------------------------------

export default function ComposerPage() {
  return (
    <>
      <SignedIn><Composer /></SignedIn>
      <SignedOut><FramerRedirect /></SignedOut>
    </>
  )
}

function FramerRedirect() {
  useEffect(() => { window.location.replace(FRAMER_URL) }, [])
  return null
}

function NoPlanWall() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#b5aca3", textTransform: "uppercase", marginBottom: "40px" }}>Lyric</p>
      <div style={{ maxWidth: "320px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", color: "#2a2622" }}>Composer requires a plan</h1>
        <p style={{ fontSize: "14px", color: "#756d65", lineHeight: 1.6 }}>
          Lyric Composer is available on Creator, Studio, and Enterprise plans.
        </p>
        <a href="/upgrade" style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: "12px", background: "#2a2622", color: "#f8f6f3", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}>
          View plans
        </a>
        <p style={{ fontSize: "12px", color: "#b5aca3", marginTop: "8px" }}>
          Already subscribed? Sign out and sign back in to refresh your session.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: "4px" }}>
          <UserButton afterSignOutUrl={FRAMER_URL} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composer — main app
// ---------------------------------------------------------------------------

function Composer() {
  const { has, isLoaded } = useAuth()
  const voices = getAllVoices()

  // Voice & variant
  const [activeVoice, setActiveVoice] = useState<VoiceDefinition>(voices[0])
  const [activeVariant, setActiveVariant] = useState<string>(voices[0].defaultIntent)

  // Paragraphs with inline marks
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([
    { id: crypto.randomUUID(), text: "", direction: "Conversational", marks: [] },
  ])
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

  // Selection toolbar
  const [selectionInfo, setSelectionInfo] = useState<{
    paraId: string
    rectLeft: number
    rectTop: number
    rectWidth: number
    offsets: { start: number; end: number }
  } | null>(null)

  // Sample audio preview
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null)
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null)

  // Generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // Player
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Usage — optimistic client-side tracking
  const [usedToday, setUsedToday] = useState(0)

  // History sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loadingCompositions, setLoadingCompositions] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Plan
  // ---------------------------------------------------------------------------

  const plan = getPlanConfig(isLoaded ? resolvePlanId(has) : undefined)
  const remaining = remainingGenerations(plan, usedToday)
  const isAtLimit = remaining !== null && remaining <= 0

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const assembledScript = paragraphs.map((p) => p.text).join("\n\n").trim()
  const isOverScriptLimit = assembledScript.length > plan.maxScriptCharacters
  const canGenerate = !isGenerating && !isAtLimit && !isOverScriptLimit && assembledScript.length > 0
  const directionOptions = getDirectionOptions(activeVoice.intents)

  // ---------------------------------------------------------------------------
  // Voice handlers
  // ---------------------------------------------------------------------------

  function selectVoice(voice: VoiceDefinition) {
    setActiveVoice(voice)
    setActiveVariant(voice.defaultIntent)
    setAudioUrl(null)
    setAudioBlob(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setGenerationError(null)
  }

  function toggleSamplePlay(voice: VoiceDefinition) {
    if (playingSampleId === voice.id) {
      sampleAudioRef.current?.pause()
      setPlayingSampleId(null)
      return
    }
    sampleAudioRef.current?.pause()
    const audio = new Audio(voice.sampleUrl)
    sampleAudioRef.current = audio
    audio.onended = () => setPlayingSampleId(null)
    audio.play().catch(() => {})
    setPlayingSampleId(voice.id)
  }

  // ---------------------------------------------------------------------------
  // Paragraph handlers
  // ---------------------------------------------------------------------------

  function addParagraph() {
    setParagraphs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: "", direction: directionOptions[0] ?? "Conversational", marks: [] },
    ])
  }

  function updateParagraphText(id: string, text: string) {
    setParagraphs((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const validMarks = p.marks.filter((m) => m.start < text.length && m.end <= text.length)
        return { ...p, text, marks: validMarks }
      })
    )
  }

  function updateParagraphDirection(id: string, direction: string) {
    setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, direction } : p)))
    setOpenPopoverId(null)
  }

  function removeParagraph(id: string) {
    setParagraphs((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id)))
  }

  function addMark(paraId: string, offsets: { start: number; end: number }, direction: string) {
    setParagraphs((prev) =>
      prev.map((p) => {
        if (p.id !== paraId) return p
        const filtered = p.marks.filter((m) => m.end <= offsets.start || m.start >= offsets.end)
        return {
          ...p,
          marks: [...filtered, { id: crypto.randomUUID(), start: offsets.start, end: offsets.end, direction }],
        }
      })
    )
    setSelectionInfo(null)
  }

  function removeMark(paraId: string, markId: string) {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === paraId ? { ...p, marks: p.marks.filter((m) => m.id !== markId) } : p))
    )
  }

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------

  async function saveComposition() {
    await fetch("/api/compositions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId: activeVoice.id,
        variant: activeVariant,
        script: assembledScript,
        directions: paragraphs,
        audioUrl: null,
        durationS: duration > 0 ? Math.round(duration) : null,
        title: paragraphs[0]?.text.slice(0, 60) || null,
      }),
    })
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  async function generate() {
    if (!assembledScript || isGenerating || isAtLimit || assembledScript.length > plan.maxScriptCharacters) return

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: activeVoice.id,
          variant: activeVariant,
          script: assembledScript,
          direction: { mode: "inline", intent: activeVariant },
          segments: assembleSegments(paragraphs),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(err.error ?? `Generation failed (${res.status})`)
      }

      const blob = await res.blob()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      const url = URL.createObjectURL(blob)
      setAudioBlob(blob)
      setAudioUrl(url)
      setCurrentTime(0)
      setUsedToday((n) => n + 1)
      saveComposition().catch((err) => console.error("[auto-save]", err))
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Player controls
  // ---------------------------------------------------------------------------

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    isPlaying ? audio.pause() : audio.play()
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    const t = parseFloat(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  function handleDownload() {
    if (!audioBlob) return
    const a = document.createElement("a")
    const url = URL.createObjectURL(audioBlob)
    a.href = url
    a.download = `${activeVoice.id}-${activeVariant.toLowerCase()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------------------------------------------------------------------------
  // History sidebar
  // ---------------------------------------------------------------------------

  const loadCompositions = useCallback(async () => {
    setLoadingCompositions(true)
    try {
      const res = await fetch("/api/compositions")
      if (res.ok) setCompositions(await res.json())
    } finally {
      setLoadingCompositions(false)
    }
  }, [])

  function openSidebar() {
    setSidebarOpen(true)
    loadCompositions()
  }

  async function deleteComposition(id: string) {
    if (!confirm("Delete this composition?")) return
    await fetch(`/api/compositions/${id}`, { method: "DELETE" })
    setCompositions((prev) => prev.filter((c) => c.id !== id))
  }

  function restoreComposition(comp: Composition) {
    const voice = voices.find((v) => v.id === comp.voice_id)
    if (voice) { setActiveVoice(voice); setActiveVariant(comp.variant) }
    if (comp.directions && comp.directions.length > 0) {
      setParagraphs(comp.directions.map((p) => ({ ...(p as Paragraph), marks: (p as any).marks ?? [] })))
    } else {
      setParagraphs([{ id: crypto.randomUUID(), text: comp.script, direction: "Conversational", marks: [] }])
    }
    setAudioUrl(null); setAudioBlob(null); setIsPlaying(false)
    setCurrentTime(0); setDuration(0); setGenerationError(null)
    setSidebarOpen(false)
  }

  function handleNewComposition() {
    if (assembledScript.trim() && !confirm("Start a new composition? Your current script will be cleared.")) return
    setParagraphs([{ id: crypto.randomUUID(), text: "", direction: directionOptions[0] ?? "Conversational", marks: [] }])
    setAudioUrl(null); setAudioBlob(null); setIsPlaying(false)
    setCurrentTime(0); setDuration(0); setGenerationError(null)
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!openPopoverId) return
    function onMouseDown(e: MouseEvent) {
      const popover = document.getElementById(`popover-${openPopoverId}`)
      if (popover && !popover.contains(e.target as Node)) setOpenPopoverId(null)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [openPopoverId])

  useEffect(() => {
    if (!sidebarOpen) return
    function onMouseDown(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setSidebarOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [sidebarOpen])

  useEffect(() => {
    if (!selectionInfo) return
    function onMouseDown() { setSelectionInfo(null) }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [selectionInfo])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
    }
  }, [audioUrl])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {})
    }
  }, [audioUrl])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function fmt(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  // No-plan gate — after all hooks
  if (isLoaded && !hasPaidPlan(has)) return <NoPlanWall />

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ minHeight: "100vh", background: "#eceae7", display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* CSS: mark labels, placeholder, contenteditable focus, hover */}
      <style>{`
        [data-mark-direction]::after {
          content: attr(data-mark-direction);
          display: inline-block; font-size: 9px;
          background: rgba(196,151,127,0.18); border: 1px solid rgba(196,151,127,0.35);
          color: #8a6050; border-radius: 100px; padding: 0 5px; margin-left: 3px;
          vertical-align: middle; line-height: 1.7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          pointer-events: none; user-select: none;
        }
        [data-placeholder]:empty::before {
          content: attr(data-placeholder); color: #b5aca3; pointer-events: none; display: block;
        }
        [contenteditable]:focus { outline: none; }
        .lyric-voice-card:hover { border-color: #eae4de !important; }
        .lyric-action-btn:hover:not(:disabled) { background: #e4e0db !important; }
      `}</style>

      {/* Hidden audio */}
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" style={{ display: "none" }} />

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        height: "52px", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(248,246,243,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #eae4de",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#2a2622", textTransform: "uppercase" }}>
          Lyric
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {isLoaded && (
            <>
              {remaining === null ? (
                <span style={{ fontSize: "11px", color: "#b5aca3" }}>Unlimited</span>
              ) : (
                <span style={{ fontSize: "11px", fontVariantNumeric: "tabular-nums", color: remaining <= 3 ? "#c4722a" : "#b5aca3" }}>
                  {remaining} left today
                </span>
              )}
              <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: "100px", background: "#eae4de", color: "#756d65", textTransform: "uppercase" }}>
                {plan.label}
              </span>
            </>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* ── 3-column layout ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* ── Left panel (260px) ────────────────────────────────────────── */}
        <div style={{
          width: "260px", flexShrink: 0,
          background: "#f5f3f0",
          borderRight: "1px solid #eae4de",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
          padding: "16px 12px 16px",
          gap: "6px",
        }}>
          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", color: "#b5aca3", textTransform: "uppercase", margin: "0 0 6px 4px" }}>
            Voice
          </p>

          {voices.map((voice) => {
            const isActive = activeVoice.id === voice.id
            return (
              <div
                key={voice.id}
                className="lyric-voice-card"
                onClick={() => selectVoice(voice)}
                style={{
                  borderRadius: "12px",
                  background: isActive ? "#ffffff" : "transparent",
                  border: `1.5px solid ${isActive ? "#c4977f" : "transparent"}`,
                  overflow: "hidden", cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  boxShadow: isActive ? "0 1px 6px rgba(196,151,127,0.12)" : "none",
                }}
              >
                {/* Gradient swatch with play button */}
                <div style={{
                  height: "72px",
                  background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSamplePlay(voice) }}
                    title="Preview sample"
                    style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: "rgba(255,255,255,0.85)", border: "none",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", color: "#2a2622",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                    }}
                  >
                    {playingSampleId === voice.id ? "⏸" : "▶"}
                  </button>
                </div>

                {/* Name + archetype */}
                <div style={{ padding: "10px 12px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: "0 0 2px" }}>
                    {voice.title}
                  </p>
                  <p style={{ fontSize: "11px", color: "#9c958f", margin: 0 }}>
                    {voice.archetype}
                  </p>

                  {/* Variant pills — active card only */}
                  {isActive && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "10px" }}>
                      {voice.intents.map((intent) => (
                        <button
                          key={intent}
                          onClick={(e) => { e.stopPropagation(); setActiveVariant(intent) }}
                          style={{
                            padding: "2px 8px", borderRadius: "100px",
                            border: `1.5px solid ${activeVariant === intent ? "#2a2622" : "#d4cfc9"}`,
                            fontSize: "10px", fontWeight: 500, cursor: "pointer",
                            background: activeVariant === intent ? "#2a2622" : "transparent",
                            color: activeVariant === intent ? "#f8f6f3" : "#9c958f",
                            transition: "all 0.12s",
                          }}
                        >
                          {intent}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* History button */}
          <div style={{ flex: 1, minHeight: "16px" }} />
          <button
            onClick={openSidebar}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "8px",
              border: "1.5px solid #eae4de",
              background: sidebarOpen ? "#eae4de" : "transparent",
              fontSize: "11px", color: "#756d65", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              transition: "background 0.15s",
            }}
          >
            <span>◷</span>
            <span>History</span>
          </button>
        </div>

        {/* ── Center area ───────────────────────────────────────────────── */}
        <main style={{
          flex: 1, overflowY: "auto",
          padding: "32px 24px 200px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>

          {/* Action bar */}
          <div style={{ width: "100%", maxWidth: "680px", display: "flex", alignItems: "center", gap: "4px", marginBottom: "16px" }}>
            <ActionButton title="New composition" onClick={handleNewComposition}>✦</ActionButton>
            <ActionButton
              title={audioBlob ? "Download" : "Generate audio to download"}
              onClick={handleDownload}
              disabled={!audioBlob}
            >
              ↓
            </ActionButton>
            <ActionButton
              title={canGenerate ? "Regenerate" : isAtLimit ? "Daily limit reached" : "Write a script to generate"}
              onClick={generate}
              disabled={!canGenerate}
            >
              ↺
            </ActionButton>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "11px", fontVariantNumeric: "tabular-nums", color: isOverScriptLimit ? "#c4722a" : "#b5aca3" }}>
              {assembledScript.length} / {plan.maxScriptCharacters}
            </span>
          </div>

          {/* Inline status messages */}
          {isOverScriptLimit && (
            <p style={{ width: "100%", maxWidth: "680px", fontSize: "12px", color: "#c4722a", margin: "-8px 0 12px" }}>
              Script exceeds {plan.label} plan limit ({plan.maxScriptCharacters} chars). Upgrade to write longer scripts.
            </p>
          )}
          {isAtLimit && !isOverScriptLimit && (
            <p style={{ width: "100%", maxWidth: "680px", fontSize: "12px", color: "#c4722a", margin: "-8px 0 12px" }}>
              Daily limit reached — resets at midnight UTC.
            </p>
          )}
          {generationError && (
            <p style={{ width: "100%", maxWidth: "680px", fontSize: "12px", color: "#c4722a", margin: "-8px 0 12px" }}>
              {generationError}
            </p>
          )}

          {/* Floating white canvas */}
          <div style={{
            width: "100%", maxWidth: "680px",
            background: "#ffffff",
            borderRadius: "4px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
            padding: "48px 56px",
          }}>

            {/* Paragraph blocks */}
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {paragraphs.map((para) => (
                <ParagraphBlock
                  key={para.id}
                  para={para}
                  openPopoverId={openPopoverId}
                  directionOptions={directionOptions}
                  onTextChange={(text) => updateParagraphText(para.id, text)}
                  onDirectionChange={(dir) => updateParagraphDirection(para.id, dir)}
                  onOpenPopover={() => setOpenPopoverId(para.id)}
                  onRemove={() => removeParagraph(para.id)}
                  canRemove={paragraphs.length > 1}
                  onSelectionChange={(info) =>
                    setSelectionInfo(info ? { paraId: para.id, ...info } : null)
                  }
                  onMarkRemove={(markId) => removeMark(para.id, markId)}
                />
              ))}
            </div>

            {/* + paragraph */}
            <button
              onClick={addParagraph}
              style={{
                marginTop: "24px",
                padding: "6px 14px", borderRadius: "8px",
                border: "1.5px dashed #d4cfc9", background: "transparent",
                fontSize: "12px", color: "#9c958f", cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              + paragraph
            </button>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={!canGenerate}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                fontSize: "14px", fontWeight: 500, marginTop: "32px",
                cursor: canGenerate ? "pointer" : "not-allowed",
                background: canGenerate ? "#2a2622" : "#eae4de",
                color: canGenerate ? "#f8f6f3" : "#b5aca3",
                transition: "all 0.15s",
              }}
            >
              {isGenerating ? "Generating…" : isAtLimit ? "Daily limit reached — resets at midnight UTC" : "Generate"}
            </button>

            {/* Guardrail */}
            <p style={{ fontSize: "11px", color: "#b5aca3", lineHeight: 1.6, marginTop: "16px" }}>
              <span style={{ color: "#9c958f" }}>Guardrail · </span>
              {activeVoice.guardrail}
            </p>
          </div>
        </main>
      </div>

      {/* ── Selection toolbar (fixed, above selection) ───────────────── */}
      {selectionInfo && (
        <SelectionToolbar
          rectLeft={selectionInfo.rectLeft}
          rectTop={selectionInfo.rectTop}
          rectWidth={selectionInfo.rectWidth}
          directionOptions={directionOptions}
          currentDirection={paragraphs.find((p) => p.id === selectionInfo.paraId)?.direction ?? ""}
          onApply={(dir) => addMark(selectionInfo.paraId, selectionInfo.offsets, dir)}
        />
      )}

      {/* ── History sidebar ───────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          ref={sidebarRef}
          style={{
            position: "fixed", top: 0, left: "260px", bottom: 0, width: "300px", zIndex: 100,
            background: "#ffffff", borderRight: "1px solid #eae4de",
            display: "flex", flexDirection: "column",
            boxShadow: "4px 0 24px rgba(42,38,34,0.08)",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eae4de", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: 0 }}>History</p>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#9c958f", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {loadingCompositions ? (
              <p style={{ fontSize: "12px", color: "#b5aca3", textAlign: "center", paddingTop: "40px" }}>Loading…</p>
            ) : compositions.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#b5aca3", textAlign: "center", paddingTop: "40px", lineHeight: 1.6 }}>
                No compositions yet.<br />Generate one to save it here.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {compositions.map((comp) => {
                  const voice = voices.find((v) => v.id === comp.voice_id)
                  const date = new Date(comp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  const preview = comp.title ?? comp.script.slice(0, 60)
                  return (
                    <div
                      key={comp.id}
                      onClick={() => restoreComposition(comp)}
                      style={{ borderRadius: "10px", border: "1px solid #eae4de", padding: "10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px" }}
                    >
                      {voice && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})` }} />
                          <span style={{ fontSize: "10px", fontWeight: 600, color: "#756d65" }}>{voice.archetype} · {comp.variant}</span>
                        </div>
                      )}
                      <p style={{ fontSize: "12px", color: "#2a2622", margin: 0, lineHeight: 1.4 }}>{preview}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <span style={{ fontSize: "10px", color: "#b5aca3" }}>{date}</span>
                        {comp.duration_s != null && <span style={{ fontSize: "10px", color: "#b5aca3" }}>{fmt(comp.duration_s)}</span>}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteComposition(comp.id) }}
                          title="Delete"
                          style={{ background: "none", border: "none", color: "#d4cfc9", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "2px" }}
                        >×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed player bar ──────────────────────────────────────────── */}
      {audioUrl && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: "12px 24px",
          background: "rgba(248,246,243,0.96)", backdropFilter: "blur(16px)",
          borderTop: "1px solid #eae4de",
          display: "flex", alignItems: "center", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "160px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0, background: `linear-gradient(135deg, ${activeVoice.gradientFrom}, ${activeVoice.gradientTo})` }} />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: 0, lineHeight: 1.2 }}>{activeVoice.archetype}</p>
              <p style={{ fontSize: "10px", color: "#9c958f", margin: 0 }}>{activeVariant}</p>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={togglePlay}
              style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#2a2622", color: "#f8f6f3", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <span style={{ fontSize: "11px", color: "#9c958f", fontVariantNumeric: "tabular-nums", width: "36px" }}>{fmt(currentTime)}</span>
            <input type="range" min={0} max={duration || 0} step={0.01} value={currentTime} onChange={handleSeek} style={{ flex: 1, accentColor: "#2a2622", height: "2px", cursor: "pointer" }} />
            <span style={{ fontSize: "11px", color: "#9c958f", fontVariantNumeric: "tabular-nums", width: "36px", textAlign: "right" }}>{fmt(duration)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ActionButton title="Download" onClick={handleDownload}>↓</ActionButton>
            <ActionButton title={canGenerate ? "Regenerate" : "Cannot regenerate now"} onClick={generate} disabled={!canGenerate}>↺</ActionButton>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  children, title, onClick, disabled = false,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="lyric-action-btn"
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        border: "none", background: "transparent",
        color: disabled ? "#d4cfc9" : "#756d65",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "15px", transition: "background 0.12s",
      }}
    >
      {children}
    </button>
  )
}

function SelectionToolbar({
  rectLeft, rectTop, rectWidth,
  directionOptions, currentDirection,
  onApply,
}: {
  rectLeft: number
  rectTop: number
  rectWidth: number
  directionOptions: string[]
  currentDirection: string
  onApply: (direction: string) => void
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: rectLeft + rectWidth / 2,
        top: rectTop - 8,
        transform: "translate(-50%, -100%)",
        zIndex: 300,
        background: "#2a2622",
        borderRadius: "10px",
        padding: "8px 10px",
        display: "flex", flexWrap: "wrap", gap: "4px",
        maxWidth: "340px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.24)",
      }}
    >
      {directionOptions.map((dir) => (
        <button
          key={dir}
          onMouseDown={(e) => { e.preventDefault(); onApply(dir) }}
          style={{
            padding: "3px 9px", borderRadius: "100px",
            border: `1px solid ${dir === currentDirection ? "#c4977f" : "rgba(255,255,255,0.18)"}`,
            background: dir === currentDirection ? "rgba(196,151,127,0.28)" : "transparent",
            color: "#f8f6f3", fontSize: "11px", fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {dir}
        </button>
      ))}
    </div>
  )
}

function ParagraphBlock({
  para, openPopoverId, directionOptions,
  onTextChange, onDirectionChange, onOpenPopover,
  onRemove, canRemove, onSelectionChange, onMarkRemove,
}: {
  para: Paragraph
  openPopoverId: string | null
  directionOptions: string[]
  onTextChange: (text: string) => void
  onDirectionChange: (direction: string) => void
  onOpenPopover: () => void
  onRemove: () => void
  canRemove: boolean
  onSelectionChange: (info: { rectLeft: number; rectTop: number; rectWidth: number; offsets: { start: number; end: number } } | null) => void
  onMarkRemove: (markId: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isOpen = openPopoverId === para.id

  // Mount only: set initial HTML
  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = buildMarkedHTML(para.text, para.marks)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Marks changed: re-render HTML (keyed on marks, NOT text — avoids cursor jump during typing)
  const marksKey = JSON.stringify(para.marks)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = buildMarkedHTML(para.text, para.marks)
    }
  }, [marksKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleInput() {
    if (!editorRef.current) return
    const raw = editorRef.current.innerText.replace(/\n$/, "")
    onTextChange(raw)
  }

  function handleMouseUp() {
    if (!editorRef.current) return
    const offsets = getSelectionCharOffsets(editorRef.current)
    if (!offsets) { onSelectionChange(null); return }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    onSelectionChange({ rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, offsets })
  }

  return (
    <div style={{ position: "relative" }}>

      {/* Direction chip row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", position: "relative" }}>
        <button
          onClick={onOpenPopover}
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 8px", borderRadius: "100px",
            background: "#f0ebe6", border: "none",
            fontSize: "12px", color: "#8a7d74", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "10px" }}>✏</span>
          {para.direction}
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove paragraph"
            style={{ width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "transparent", color: "#d4cfc9", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        )}

        {/* Popover — opens ABOVE chip */}
        {isOpen && (
          <div
            id={`popover-${para.id}`}
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: 0,
              zIndex: 200,
              background: "#ffffff",
              border: "1px solid #eae4de",
              borderRadius: "12px",
              padding: "12px",
              boxShadow: "0 8px 24px rgba(42,38,34,0.12)",
              display: "flex", flexWrap: "wrap", gap: "6px",
              width: "280px",
            }}
          >
            {directionOptions.map((dir) => (
              <button
                key={dir}
                onClick={() => onDirectionChange(dir)}
                style={{
                  padding: "4px 10px", borderRadius: "100px",
                  border: `1.5px solid ${para.direction === dir ? "#2a2622" : "#d4cfc9"}`,
                  fontSize: "11px", fontWeight: 500, cursor: "pointer",
                  background: para.direction === dir ? "#2a2622" : "transparent",
                  color: para.direction === dir ? "#f8f6f3" : "#756d65",
                  transition: "all 0.1s",
                }}
              >
                {dir}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenteditable body */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your script here…"
        onInput={handleInput}
        onMouseUp={handleMouseUp}
        style={{
          minHeight: "72px",
          fontSize: "20px", lineHeight: "1.85",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#2a2622",
          wordBreak: "break-word",
        }}
      />

      {/* Mark chips (removable) */}
      {para.marks.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
          {para.marks.map((mark) => (
            <span
              key={mark.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                background: "rgba(196,151,127,0.12)", border: "1px solid rgba(196,151,127,0.3)",
                borderRadius: "100px", padding: "2px 6px 2px 8px",
                fontSize: "10px", color: "#8a6050",
              }}
            >
              {mark.direction}
              <button
                onClick={() => onMarkRemove(mark.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#c4977f", fontSize: "11px", lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
