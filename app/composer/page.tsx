"use client"

import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { getAllVoices, VoiceDefinition } from "@/lib/voiceData"
import { getPlanConfig, remainingGenerations, resolvePlanId, hasPaidPlan } from "@/lib/planConfig"
import { Plus, Download, RotateCcw, Clock, X } from "lucide-react"

const FRAMER_URL = "https://formal-organization-793965.framer.app"

// Change 4: 6 inline directions
const INLINE_DIRECTIONS = ["Emphasis", "Pause", "Whisper", "Slow", "Tender", "Resolute"]

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

// Change 4: no args, returns all 6 directions
function getDirectionOptions(): string[] {
  return [...INLINE_DIRECTIONS]
}

function assembleSegments(paragraphs: Paragraph[], defaultIntent: string): Array<{ text: string; intent: string }> {
  const segments: Array<{ text: string; intent: string }> = []
  for (const para of paragraphs) {
    if (!para.text.trim()) continue
    if (!para.marks.length) {
      segments.push({ text: para.text, intent: defaultIntent })
      continue
    }
    const sorted = [...para.marks].sort((a, b) => a.start - b.start)
    let cursor = 0
    for (const mark of sorted) {
      if (mark.start > cursor) {
        const chunk = para.text.slice(cursor, mark.start)
        if (chunk.trim()) segments.push({ text: chunk, intent: defaultIntent })
      }
      const marked = para.text.slice(mark.start, mark.end)
      if (marked.trim()) segments.push({ text: marked, intent: mark.direction })
      cursor = mark.end
    }
    if (cursor < para.text.length) {
      const tail = para.text.slice(cursor)
      if (tail.trim()) segments.push({ text: tail, intent: defaultIntent })
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
    <div style={{ minHeight: "100vh", background: "#faf9f7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#b5aca3", textTransform: "uppercase", marginBottom: "40px" }}>Lyric</p>
      <div style={{ maxWidth: "320px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", color: "#2a2622" }}>Composer requires a plan</h1>
        <p style={{ fontSize: "14px", color: "#756d65", lineHeight: 1.6 }}>
          Lyric Composer is available on Creator, Studio, and Enterprise plans.
        </p>
        <a href="/upgrade" style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: "12px", background: "#2a2622", color: "#faf9f7", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}>
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

  // Selection toolbar
  const [selectionInfo, setSelectionInfo] = useState<{
    paraId: string
    rectLeft: number
    rectTop: number
    rectWidth: number
    offsets: { start: number; end: number }
  } | null>(null)

  // Change 2: click-to-open popover (no hover/timeout)
  const [hoveredVoice, setHoveredVoice] = useState<{
    voice: VoiceDefinition
    pillLeft: number
    pillBottom: number
  } | null>(null)
  const voicePopoverRef = useRef<HTMLDivElement>(null)

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

  // History drawer
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loadingCompositions, setLoadingCompositions] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // FTU state
  const [ftuScript, setFtuScript] = useState(false)
  const [ftuHighlight, setFtuHighlight] = useState(false)
  const [ftuGenerate, setFtuGenerate] = useState(false)
  const ftuHighlightFired = useRef(false)
  const ftuGenerateFired = useRef(false)
  const scriptAreaRef = useRef<HTMLDivElement>(null)
  const generateBtnRef = useRef<HTMLButtonElement>(null)

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
  // Change 4: no args
  const directionOptions = getDirectionOptions()

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
      { id: crypto.randomUUID(), text: "", direction: activeVariant, marks: [] },
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
          segments: assembleSegments(paragraphs, activeVariant),
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
  // History drawer
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
    setParagraphs([{ id: crypto.randomUUID(), text: "", direction: activeVariant, marks: [] }])
    setAudioUrl(null); setAudioBlob(null); setIsPlaying(false)
    setCurrentTime(0); setDuration(0); setGenerationError(null)
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

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

  // Change 2: click-outside closes voice popover
  useEffect(() => {
    if (!hoveredVoice) return
    function onMouseDown(e: MouseEvent) {
      if (voicePopoverRef.current && !voicePopoverRef.current.contains(e.target as Node)) {
        setHoveredVoice(null)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [hoveredVoice])

  // FTU 1 — script tooltip, 1.2s after mount
  useEffect(() => {
    if (localStorage.getItem("lyric_ftu_script")) return
    const t = setTimeout(() => setFtuScript(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // FTU 2 — highlight tooltip, after 20 chars typed
  useEffect(() => {
    if (localStorage.getItem("lyric_ftu_highlight")) return
    if (assembledScript.length < 20 || ftuHighlightFired.current) return
    ftuHighlightFired.current = true
    const t = setTimeout(() => setFtuHighlight(true), 800)
    return () => clearTimeout(t)
  }, [assembledScript.length])

  function dismissFtu1() {
    localStorage.setItem("lyric_ftu_script", "1")
    setFtuScript(false)
  }

  function dismissFtu2() {
    localStorage.setItem("lyric_ftu_highlight", "1")
    setFtuHighlight(false)
    if (!localStorage.getItem("lyric_ftu_generate") && !ftuGenerateFired.current) {
      ftuGenerateFired.current = true
      setTimeout(() => setFtuGenerate(true), 1000)
    }
  }

  function dismissFtu3() {
    localStorage.setItem("lyric_ftu_generate", "1")
    setFtuGenerate(false)
  }

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
    <div style={{ minHeight: "100vh", background: "#faf9f7", display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      <style>{`
        html, body { background: #faf9f7 !important; margin: 0; }
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
        .lyric-action-btn:hover:not(:disabled) { background: #e4e0db !important; }
        .lyric-action-btn-inv:hover:not(:disabled) { background: rgba(248,246,243,0.08) !important; }
        .lyric-toolbar-row { scrollbar-width: none; }
        .lyric-toolbar-row::-webkit-scrollbar { display: none; }
        .lyric-scrubber { -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px; background: rgba(248,246,243,0.2); outline: none; cursor: pointer; }
        .lyric-scrubber::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #faf9f7; cursor: pointer; }
        .lyric-scrubber::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #faf9f7; border: none; cursor: pointer; }
        @keyframes lyric-progress {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(400%); }
        }
        @keyframes lyric-ftu-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lyric-ftu-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(4px); }
        }
      `}</style>

      {/* Hidden audio */}
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" style={{ display: "none" }} />

      {/* ── Top bar (52px, sticky) ───────────────────────────────────────── */}
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

      {/* ── Voice toolbar (48px, sticky below top bar) ───────────────────── */}
      <div style={{
        position: "sticky", top: "52px", zIndex: 40,
        height: "48px",
        background: "rgba(248,246,243,0.96)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #eae4de",
      }}>
        <div
          className="lyric-toolbar-row"
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            overflowX: "auto",
            padding: "0 24px",
            height: "100%",
          }}
        >
          {/* Change 1: Eyebrow "Voices" */}
          <span style={{
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em",
            color: "#b5aca3", textTransform: "uppercase", flexShrink: 0,
          }}>
            Voices
          </span>

          {/* Divider after eyebrow */}
          <div style={{ width: "1px", height: "20px", background: "#eae4de", flexShrink: 0, margin: "0 2px" }} />

          {/* Change 2: Voice pills — click to toggle popover */}
          {voices.map((voice) => {
            const isActive = activeVoice.id === voice.id
            return (
              <button
                key={voice.id}
                onClick={(e) => {
                  selectVoice(voice)
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoveredVoice((prev) =>
                    prev?.voice.id === voice.id ? null : { voice, pillLeft: rect.left, pillBottom: rect.bottom }
                  )
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  height: "32px", padding: "0 12px",
                  borderRadius: "100px",
                  border: isActive ? "none" : "1px solid #d4cfc9",
                  background: isActive ? "#2a2622" : "transparent",
                  color: isActive ? "#faf9f7" : "#756d65",
                  fontSize: "12px", fontWeight: isActive ? 500 : 400,
                  cursor: "pointer", flexShrink: 0,
                  transition: "all 0.12s",
                }}
              >
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                  background: voice.gradientFrom,
                  opacity: isActive ? 0.7 : 1,
                }} />
                {voice.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Script area ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "0 24px" }}>
        <div ref={scriptAreaRef} style={{ maxWidth: "680px", margin: "0 auto", padding: "48px 0 200px" }}>

          {/* Action bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
            <ActionButton title="New composition" onClick={handleNewComposition}><Plus size={20} strokeWidth={1.5} /></ActionButton>
            <ActionButton
              title={audioBlob ? "Download" : "Generate audio to download"}
              onClick={handleDownload}
              disabled={!audioBlob}
            >
              <Download size={20} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton
              title={canGenerate ? "Regenerate" : isAtLimit ? "Daily limit reached" : "Write a script to generate"}
              onClick={generate}
              disabled={!canGenerate}
            >
              <RotateCcw size={20} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton title="History" onClick={openSidebar}><Clock size={20} strokeWidth={1.5} /></ActionButton>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "11px", fontVariantNumeric: "tabular-nums", color: isOverScriptLimit ? "#c4722a" : "#b5aca3" }}>
              {assembledScript.length} / {plan.maxScriptCharacters}
            </span>
          </div>

          {/* Status messages */}
          {isOverScriptLimit && (
            <p style={{ fontSize: "12px", color: "#c4722a", margin: "0 0 16px" }}>
              Script exceeds {plan.label} plan limit ({plan.maxScriptCharacters} chars). Upgrade to write longer scripts.
            </p>
          )}
          {isAtLimit && !isOverScriptLimit && (
            <p style={{ fontSize: "12px", color: "#c4722a", margin: "0 0 16px" }}>
              Daily limit reached — resets at midnight UTC.
            </p>
          )}
          {generationError && (
            <p style={{ fontSize: "12px", color: "#c4722a", margin: "0 0 16px" }}>
              {generationError}
            </p>
          )}

          <FTUTooltip
            message="Write your script here. Highlight any phrase to shape how it's delivered."
            visible={ftuScript}
            anchorRef={scriptAreaRef}
            onDismiss={dismissFtu1}
          />

          {/* Paragraph blocks */}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {paragraphs.map((para) => (
              <ParagraphBlock
                key={para.id}
                para={para}
                onTextChange={(text) => updateParagraphText(para.id, text)}
                onRemove={() => removeParagraph(para.id)}
                canRemove={paragraphs.length > 1}
                onSelectionChange={(info) =>
                  setSelectionInfo(info ? { paraId: para.id, ...info } : null)
                }
                onMarkRemove={(markId) => removeMark(para.id, markId)}
              />
            ))}
          </div>

          <FTUTooltip
            message="Select a word or phrase to apply emotional direction."
            visible={ftuHighlight}
            anchorRef={scriptAreaRef}
            onDismiss={dismissFtu2}
          />

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
            ref={generateBtnRef}
            onClick={generate}
            disabled={!canGenerate}
            style={{
              width: "100%", padding: "14px", borderRadius: "14px", border: "none",
              fontSize: "14px", fontWeight: 500, marginTop: "32px",
              cursor: canGenerate ? "pointer" : "not-allowed",
              background: canGenerate || isGenerating ? "#2a2622" : "#eae4de",
              color: canGenerate || isGenerating ? "#faf9f7" : "#b5aca3",
              transition: "background 0.15s",
            }}
          >
            {isGenerating ? "Generating…" : isAtLimit ? "Daily limit reached — resets at midnight UTC" : "Generate"}
          </button>

          {/* Generation progress bar */}
          {isGenerating && (
            <div style={{ width: "100%", height: "3px", background: "#eae4de", borderRadius: "100px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "40%", background: "linear-gradient(90deg, transparent, #c4977f, transparent)", borderRadius: "100px", animation: "lyric-progress 1.6s ease-in-out infinite" }} />
            </div>
          )}

          <FTUTooltip
            message="When you're ready, generate to hear your script voiced."
            visible={ftuGenerate}
            anchorRef={generateBtnRef}
            onDismiss={dismissFtu3}
          />

        </div>
      </main>

      {/* ── Voice popover (fixed, click-to-open) ─────────────────────────── */}
      {hoveredVoice && (
        <div
          ref={voicePopoverRef}
          style={{
            position: "fixed",
            left: hoveredVoice.pillLeft,
            top: hoveredVoice.pillBottom + 8,
            zIndex: 200,
            width: "220px",
            background: "#ffffff",
            border: "1px solid #eae4de",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 8px 24px rgba(42,38,34,0.1)",
          }}
        >
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#2a2622", margin: "0 0 2px" }}>
            {hoveredVoice.voice.title}
          </p>
          <p style={{ fontSize: "11px", color: "#9c958f", margin: "0 0 8px" }}>
            {hoveredVoice.voice.archetype}
          </p>
          <p style={{ fontSize: "12px", color: "#756d65", lineHeight: 1.5, margin: "0 0 12px" }}>
            {hoveredVoice.voice.blurb}
          </p>

          {/* Change 2: "DELIVERY" label above variant pills */}
          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em", color: "#b5aca3", textTransform: "uppercase", margin: "0 0 6px" }}>
            Delivery
          </p>

          {/* Variant pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
            {hoveredVoice.voice.intents.map((intent) => {
              const isActiveIntent = hoveredVoice.voice.id === activeVoice.id && activeVariant === intent
              return (
                <button
                  key={intent}
                  onClick={() => {
                    selectVoice(hoveredVoice.voice)
                    setActiveVariant(intent)
                    setHoveredVoice(null)
                  }}
                  style={{
                    padding: "3px 10px", borderRadius: "100px",
                    border: isActiveIntent ? "none" : "1px solid #d4cfc9",
                    background: isActiveIntent ? "#2a2622" : "transparent",
                    color: isActiveIntent ? "#faf9f7" : "#756d65",
                    fontSize: "11px", fontWeight: isActiveIntent ? 500 : 400,
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  {intent}
                </button>
              )
            })}
          </div>

          {/* Sample play button */}
          <button
            onClick={() => toggleSamplePlay(hoveredVoice.voice)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "5px 10px", borderRadius: "8px",
              border: "1px solid #d4cfc9", background: "transparent",
              fontSize: "11px", color: "#756d65", cursor: "pointer",
            }}
          >
            {playingSampleId === hoveredVoice.voice.id ? "⏸ Stop" : "▶ Play sample"}
          </button>
        </div>
      )}

      {/* ── Selection toolbar ────────────────────────────────────────────── */}
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

      {/* ── History drawer (right edge) ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          ref={sidebarRef}
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "320px", zIndex: 100,
            background: "#ffffff", borderLeft: "1px solid #eae4de",
            display: "flex", flexDirection: "column",
            boxShadow: "-4px 0 24px rgba(42,38,34,0.08)",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eae4de", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: 0 }}>History</p>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#9c958f", cursor: "pointer", padding: "0 2px", display: "flex" }}><X size={16} strokeWidth={1.5} /></button>
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

      {/* Change 5: Floating pill player bar */}
      {audioUrl && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 50, width: "480px", maxWidth: "calc(100vw - 48px)",
          background: "#2a2622", borderRadius: "100px",
          padding: "10px 24px",
          display: "flex", alignItems: "center", gap: "12px",
          boxShadow: "0 8px 32px rgba(42,38,34,0.28)",
        }}>
          {/* Voice dot + label */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(135deg, ${activeVoice.gradientFrom}, ${activeVoice.gradientTo})`,
            }} />
            <span style={{ fontSize: "11px", fontWeight: 500, color: "rgba(248,246,243,0.7)", whiteSpace: "nowrap" }}>
              {activeVoice.title}
            </span>
          </div>

          {/* Play button */}
          <button
            onClick={togglePlay}
            style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: "rgba(248,246,243,0.12)", color: "#faf9f7",
              border: "none", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", cursor: "pointer", flexShrink: 0,
              transition: "background 0.12s",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* Elapsed */}
          <span style={{ fontSize: "11px", color: "rgba(248,246,243,0.5)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmt(currentTime)}
          </span>

          {/* Scrubber */}
          <input
            type="range" min={0} max={duration || 0} step={0.01} value={currentTime}
            onChange={handleSeek}
            className="lyric-scrubber"
            style={{ flex: 1 }}
          />

          {/* Remaining */}
          <span style={{ fontSize: "11px", color: "rgba(248,246,243,0.5)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            -{fmt(Math.max(0, duration - currentTime))}
          </span>

          {/* Inverted action buttons */}
          <ActionButton inverted title="Download" onClick={handleDownload}><Download size={20} strokeWidth={1.5} /></ActionButton>
          <ActionButton inverted title={canGenerate ? "Regenerate" : "Cannot regenerate now"} onClick={generate} disabled={!canGenerate}><RotateCcw size={20} strokeWidth={1.5} /></ActionButton>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  children, title, onClick, disabled = false, inverted = false,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  inverted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={inverted ? "lyric-action-btn-inv" : "lyric-action-btn"}
      style={{
        width: "40px", height: "40px", borderRadius: "8px",
        border: "none", background: "transparent",
        color: disabled
          ? (inverted ? "rgba(248,246,243,0.3)" : "#d4cfc9")
          : (inverted ? "rgba(248,246,243,0.6)" : "#756d65"),
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s",
      }}
    >
      {children}
    </button>
  )
}

function FTUTooltip({
  message, visible, anchorRef, onDismiss,
}: {
  message: string
  visible: boolean
  anchorRef: { current: HTMLElement | null }
  onDismiss: () => void
}) {
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out">("hidden")
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!visible) { setPhase("hidden"); return }
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ left: rect.left + rect.width / 2, top: rect.top })
    }
    setPhase("in")
    const visTimer = setTimeout(() => setPhase("visible"), 400)
    const outTimer = setTimeout(() => setPhase("out"), 4000)
    const doneTimer = setTimeout(() => { setPhase("hidden"); onDismiss() }, 4400)
    return () => { clearTimeout(visTimer); clearTimeout(outTimer); clearTimeout(doneTimer) }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "hidden") return null

  return (
    <div
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top - 16,
        zIndex: 400,
        width: "240px",
        background: "rgba(42,38,34,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        pointerEvents: "none",
        opacity: phase === "out" ? 0 : 1,
        transform: phase === "in" ? "translate(-50%, calc(-100% + 6px))" : "translate(-50%, -100%)",
        transition: phase === "in"
          ? "opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)"
          : phase === "out" ? "opacity 0.3s ease" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "16px", right: "16px", height: "2px", background: "linear-gradient(90deg, #c4977f, transparent)", borderRadius: "2px 2px 0 0" }} />
      <p style={{ fontSize: "12px", color: "rgba(248,246,243,0.88)", lineHeight: 1.65, margin: 0, paddingTop: "4px" }}>
        {message}
      </p>
      <div style={{ position: "absolute", bottom: "-7px", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid rgba(42,38,34,0.92)" }} />
    </div>
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
            color: "#faf9f7", fontSize: "11px", fontWeight: 500,
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
  para,
  onTextChange, onRemove, canRemove,
  onSelectionChange, onMarkRemove,
}: {
  para: Paragraph
  onTextChange: (text: string) => void
  onRemove: () => void
  canRemove: boolean
  onSelectionChange: (info: { rectLeft: number; rectTop: number; rectWidth: number; offsets: { start: number; end: number } } | null) => void
  onMarkRemove: (markId: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = buildMarkedHTML(para.text, para.marks)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      {canRemove && (
        <button
          onClick={onRemove}
          title="Remove paragraph"
          style={{
            position: "absolute", top: 0, right: 0,
            width: "18px", height: "18px", borderRadius: "50%", border: "none",
            background: "transparent", color: "#d4cfc9", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>
      )}

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

      {/* Mark chips */}
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
              >×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
