"use client"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { createClient } from "@/lib/supabase/client"
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { getAllVoices, VoiceDefinition } from "@/lib/voiceData"
import { getPlanConfig, remainingGenerations, resolvePlanId, hasPaidPlan } from "@/lib/planConfig"
import { Plus, Download, RotateCcw } from "lucide-react"
import { trackGeneration, trackDownload, trackPreview } from "@/lib/analytics"
import Wordmark from "@/components/Wordmark"

const MARKETING_URL = "https://lyric-marketing.vercel.app"

// Inline direction marks are derived per-voice from palette.emotionGroups

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
    result += `<span data-mark-id="${mark.id}" data-mark-direction="${mark.direction}" style="background:rgba(184,149,90,0.15);border-radius:3px;padding:1px 0;">${escapeHtml(text.slice(mark.start, mark.end))}</span>`
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

function getDirectionOptions(voice: VoiceDefinition): string[] {
  const emotionGroup = voice.palette.emotionGroups.find((g) => g.label === "Emotional Range")
  if (!emotionGroup) return []
  return emotionGroup.items.map((item) => item.label)
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
// Page
// ---------------------------------------------------------------------------

export default function ComposerPage() {
  return <Composer />
}

function NoPlanWall() {
  useEffect(() => { window.location.replace(`${MARKETING_URL}/pricing`) }, [])
  return null
}

function ProfileDropdown() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace(MARKETING_URL)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className={`lyric-profile-btn${!open ? " lyric-tip" : ""}`}
        data-tip="Account"
        style={{
          background: "#eae4de", border: "none", cursor: "pointer",
          width: "28px", height: "28px", borderRadius: "50%",
          display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#756d65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: "180px",
          background: "#ffffff",
          border: "1px solid #eae4de",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(42,38,34,0.1)",
          padding: "6px",
          zIndex: 200,
        }}>
          <a
            href="/upgrade"
            className="lyric-dropdown-item"
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "8px",
              fontSize: "13px", color: "#2a2622",
              textDecoration: "none", cursor: "pointer",
              transition: "background 0.12s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#756d65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </a>
          <button
            onClick={handleSignOut}
            className="lyric-dropdown-item"
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "8px",
              fontSize: "13px", color: "#2a2622",
              background: "none", border: "none", width: "100%",
              textAlign: "left", cursor: "pointer",
              transition: "background 0.12s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#756d65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function TutorialButton() {
  return (
    <a
      href="/onboarding?revisit=1"
      className="lyric-tip lyric-header-icon"
      data-tip="Tutorial"
      style={{
        background: "#eae4de", border: "none", cursor: "pointer",
        width: "28px", height: "28px", borderRadius: "50%",
        display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
        textDecoration: "none",
        transition: "background 0.15s",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#756d65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Composer — main app
// ---------------------------------------------------------------------------

function Composer() {
  const { plan: planTier, isLoaded, onboardingVoice, onboardingIntent, lastVoice, lastIntent } = useCurrentUser()
  const voices = getAllVoices()

  // Voice & variant — default to onboarding selection if available
  const [activeVoice, setActiveVoice] = useState<VoiceDefinition>(voices[0])
  const [activeVariant, setActiveVariant] = useState<string>(voices[0].defaultIntent)
  const [hasRestoredOnboardingVoice, setHasRestoredOnboardingVoice] = useState(false)

  useEffect(() => {
    if (hasRestoredOnboardingVoice || !isLoaded) return
    // Priority: last-used voice > onboarding voice > default (voices[0])
    const voiceId = lastVoice ?? onboardingVoice
    const intent = lastIntent ?? onboardingIntent
    if (voiceId) {
      const match = voices.find((v) => v.id === voiceId)
      if (match) {
        setActiveVoice(match)
        setActiveVariant(intent ?? match.defaultIntent)
      }
    }
    setHasRestoredOnboardingVoice(true)
  }, [isLoaded, lastVoice, lastIntent, onboardingVoice, onboardingIntent, voices, hasRestoredOnboardingVoice])

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

  // Floating voice panel
  const [voicePanelOpen, setVoicePanelOpen] = useState(true)

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

  // History panel (left side)
  const [compositions, setCompositions] = useState<Composition[]>([])
  const [loadingCompositions, setLoadingCompositions] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)
  const [currentCompositionId, setCurrentCompositionId] = useState<string | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)

  const scriptAreaRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Plan
  // ---------------------------------------------------------------------------

  const plan = getPlanConfig(isLoaded ? resolvePlanId(planTier) : undefined)
  const remaining = remainingGenerations(plan, usedToday)
  const isAtLimit = remaining !== null && remaining <= 0

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const assembledScript = paragraphs.map((p) => p.text).join("\n\n").trim()
  const isOverScriptLimit = assembledScript.length > plan.maxScriptCharacters
  const canGenerate = !isGenerating && !isAtLimit && !isOverScriptLimit && assembledScript.length > 0
  const directionOptions = getDirectionOptions(activeVoice)

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
    trackPreview({ voiceId: voice.id })
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
    // Wait for any in-flight save to finish before starting a new one.
    // This prevents duplicate POSTs when generate() is called rapidly.
    if (saveInFlightRef.current) {
      await saveInFlightRef.current
    }

    const doSave = async () => {
      const payload = {
        voiceId: activeVoice.id,
        variant: activeVariant,
        script: assembledScript,
        directions: paragraphs,
        audioUrl: null,
        durationS: duration > 0 ? Math.round(duration) : null,
        title: paragraphs[0]?.text.slice(0, 60) || null,
      }

      if (currentCompositionId) {
        // Update existing composition
        await fetch(`/api/compositions/${currentCompositionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        // Create or upsert composition (server deduplicates by script)
        const res = await fetch("/api/compositions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) setCurrentCompositionId(data.id)
      }

      // Refresh history list after save
      loadCompositions().catch(() => {})
    }

    const promise = doSave()
    saveInFlightRef.current = promise
    try {
      await promise
    } finally {
      if (saveInFlightRef.current === promise) {
        saveInFlightRef.current = null
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  async function generate() {
    if (!assembledScript || isGenerating || isAtLimit || assembledScript.length > plan.maxScriptCharacters) return

    setIsGenerating(true)
    setGenerationError(null)
    const startedAt = Date.now()

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

      // Persist last-used voice for next session
      fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_last_voice", voiceId: activeVoice.id, intent: activeVariant }),
      }).catch(() => {})

      // Analytics — dominant direction = mark covering most chars, else active variant
      const markCounts: Record<string, number> = {}
      for (const p of paragraphs) {
        for (const m of p.marks) markCounts[m.direction] = (markCounts[m.direction] ?? 0) + (m.end - m.start)
      }
      const entries = Object.entries(markCounts)
      const dominantDirection = entries.length
        ? entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
        : activeVariant
      trackGeneration({
        voiceId: activeVoice.id,
        voiceVariant: activeVariant,
        emotionalDirection: dominantDirection,
        characterCount: assembledScript.length,
        durationMs: Date.now() - startedAt,
      })
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
    trackDownload({
      voiceId: activeVoice.id,
      voiceVariant: activeVariant,
      audioDurationS: duration > 0 ? duration : undefined,
    })
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  const loadCompositions = useCallback(async () => {
    setLoadingCompositions(true)
    try {
      const res = await fetch("/api/compositions")
      if (res.ok) {
        const data: Composition[] = await res.json()
        setCompositions(data)

        // If no current composition is set, try to match the current script
        // to an existing composition so subsequent saves use PATCH (update)
        // instead of POST (create), preventing duplicates after refresh.
        if (!currentCompositionId && assembledScript.trim()) {
          const match = data.find(
            (c) => c.script.trim() === assembledScript.trim()
          )
          if (match) setCurrentCompositionId(match.id)
        }
      }
    } finally {
      setLoadingCompositions(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompositionId])


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
    setCurrentCompositionId(comp.id)
  }

  function handleNewComposition() {
    if (assembledScript.trim() && !confirm("Start a new composition? Your current script will be cleared.")) return
    setParagraphs([{ id: crypto.randomUUID(), text: "", direction: activeVariant, marks: [] }])
    setAudioUrl(null); setAudioBlob(null); setIsPlaying(false)
    setCurrentTime(0); setDuration(0); setGenerationError(null)
    setCurrentCompositionId(null)
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load compositions on mount
  useEffect(() => { loadCompositions() }, [loadCompositions])

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
  if (isLoaded && !hasPaidPlan(planTier)) return <NoPlanWall />

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
          background: rgba(184,149,90,0.18); border: 1px solid rgba(184,149,90,0.35);
          color: #8a6050; border-radius: 100px; padding: 0 5px; margin-left: 3px;
          vertical-align: middle; line-height: 1.7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          pointer-events: none; user-select: none;
        }
        [data-placeholder]:empty::before {
          content: attr(data-placeholder); color: #b5aca3; pointer-events: none; display: block;
        }
        [data-placeholder]:empty::after {
          content: ""; display: inline-block; width: 1.5px; height: 1.1em;
          background: #b5aca3; margin-left: 2px; vertical-align: text-bottom;
          animation: lyric-blink 1s steps(2, start) infinite;
        }
        @keyframes lyric-blink { to { opacity: 0; } }
        [contenteditable]:focus { outline: none; }
        .lyric-action-btn:hover:not(:disabled) { background: #e4e0db !important; }
        .lyric-action-btn-inv:hover:not(:disabled) { background: rgba(248,246,243,0.08) !important; }
        .lyric-header-icon:hover { background: #e0dbd5 !important; }
        .lyric-profile-btn:hover { background: #e0dbd5 !important; }
        .lyric-dropdown-item:hover { background: #f5f3ef !important; }
        .lyric-tip { position: relative; }
        .lyric-tip::after {
          content: attr(data-tip);
          position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
          background: rgba(42,38,34,0.92); color: rgba(248,246,243,0.88);
          font-size: 11px; font-weight: 400; letter-spacing: 0;
          white-space: nowrap; padding: 5px 10px; border-radius: 6px;
          pointer-events: none; opacity: 0; transition: opacity 0.15s ease;
          z-index: 300; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .lyric-tip:hover::after { opacity: 1; }
        .lyric-tip-up::after { top: auto; bottom: calc(100% + 8px); }
        .lyric-toolbar-row { scrollbar-width: none; }
        .lyric-toolbar-row::-webkit-scrollbar { display: none; }
        .lyric-voice-panel-scroll { scrollbar-width: none; }
        .lyric-voice-panel-scroll::-webkit-scrollbar { display: none; }
        .lyric-history-scroll { scrollbar-width: none; }
        .lyric-history-scroll::-webkit-scrollbar { display: none; }
        .lyric-history-item:hover { background: rgba(234,228,222,0.5) !important; }
        .lyric-history-item:hover .lyric-history-delete { opacity: 1 !important; }
        .lyric-history-delete:hover { color: #756d65 !important; background: rgba(234,228,222,0.6) !important; }
        .lyric-panel-tab:hover { background: #f5f3ef !important; }
        .lyric-vp-card { transition: background 0.15s ease; }
        .lyric-vp-card:hover { background: rgba(234,228,222,0.5) !important; }
        .lyric-vp-expr { transition: background 0.12s ease; }
        .lyric-vp-expr:hover { background: #eae4de !important; }
        .lyric-vp-sample { transition: background 0.12s ease; }
        .lyric-vp-sample:hover { background: #eae4de !important; }
        .lyric-scrubber { -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px; background: rgba(248,246,243,0.2); outline: none; cursor: pointer; }
        .lyric-scrubber::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #faf9f7; cursor: pointer; }
        .lyric-scrubber::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #faf9f7; border: none; cursor: pointer; }
        @keyframes lyric-sweep {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
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
        <Wordmark height={32} color="#2a2622" />
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
          <TutorialButton />
          <ProfileDropdown />
        </div>
      </header>

      {/* ── Script area ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "0 24px", transition: "none" }}>
        <div ref={scriptAreaRef} style={{ maxWidth: "680px", margin: "0 auto", padding: "48px 0 200px" }}>

          {/* Action bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
            <ActionButton title="New composition" onClick={handleNewComposition}><Plus size={20} strokeWidth={1.5} /></ActionButton>
            <ActionButton
              title="Download audio"
              onClick={handleDownload}
              disabled={!audioBlob}
            >
              <Download size={20} strokeWidth={1.5} />
            </ActionButton>
            <ActionButton
              title={isAtLimit ? "Daily limit reached" : "Regenerate audio"}
              onClick={generate}
              disabled={!canGenerate}
            >
              <RotateCcw size={20} strokeWidth={1.5} />
            </ActionButton>

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
            disabled={!canGenerate && !isGenerating}
            style={{
              width: "100%", padding: "14px", borderRadius: "14px", border: "none",
              fontSize: "14px", fontWeight: 500, marginTop: "32px",
              cursor: canGenerate ? "pointer" : "not-allowed",
              background: canGenerate || isGenerating ? "#2a2622" : "#eae4de",
              color: canGenerate || isGenerating ? "#faf9f7" : "#b5aca3",
              transition: "background 0.15s",
              position: "relative", overflow: "hidden",
            }}
          >
            {isGenerating && (
              <span
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, #2a2622 0%, #B8955A 40%, #9A7A45 60%, #2a2622 100%)",
                  backgroundSize: "200% 100%",
                  animation: "lyric-sweep 2s ease-in-out infinite",
                  borderRadius: "14px",
                  opacity: 0.9,
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>
              {isGenerating ? "Generating…" : isAtLimit ? "Daily limit reached" : "Generate"}
            </span>
          </button>

        </div>
      </main>

      {/* ── History Rail (left side) ─────────────────────────────────── */}
      {compositions.length > 0 && (
        <div
          onMouseEnter={() => setHistoryPanelOpen(true)}
          onMouseLeave={() => setHistoryPanelOpen(false)}
          style={{
            position: "fixed",
            left: 0,
            top: "52px",
            bottom: 0,
            width: historyPanelOpen ? "272px" : "48px",
            zIndex: 55,
            background: historyPanelOpen ? "rgba(248,246,243,0.97)" : "transparent",
            backdropFilter: historyPanelOpen ? "blur(16px)" : "none",
            borderRight: historyPanelOpen ? "1px solid #eae4de" : "1px solid transparent",
            transition: "width 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s ease, border-color 0.3s ease",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Rail icon — top-aligned with voice panel */}
          <div style={{
            padding: "0 0 6px 16px",
            flexShrink: 0,
            marginTop: "max(0px, calc(50vh - 52px - 300px))",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b5aca3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          {/* Scrollable content */}
          <div className="lyric-history-scroll" style={{
            flex: 1,
            overflowY: historyPanelOpen ? "auto" : "hidden",
            overflowX: "hidden",
          }}>
            {(() => {
              const now = new Date()
              const todayStr = now.toDateString()
              const yesterday = new Date(now)
              yesterday.setDate(yesterday.getDate() - 1)
              const yesterdayStr = yesterday.toDateString()

              let lastGroup = ""
              return compositions.slice(0, 20).map((comp) => {
                const voice = voices.find((v) => v.id === comp.voice_id)
                const preview = comp.title ?? comp.script.slice(0, 60)
                const compDate = new Date(comp.created_at)
                const compDateStr = compDate.toDateString()
                let group = ""
                if (compDateStr === todayStr) group = "Today"
                else if (compDateStr === yesterdayStr) group = "Yesterday"
                else group = compDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })

                const showGroup = group !== lastGroup
                lastGroup = group

                return (
                  <div key={comp.id}>
                    {showGroup && (
                      <div style={{
                        padding: historyPanelOpen ? "14px 16px 6px" : "14px 0 6px 16px",
                        fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
                        color: "#b5aca3", textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textAlign: historyPanelOpen ? "left" : "center",
                        opacity: historyPanelOpen ? 1 : 0,
                        height: historyPanelOpen ? "auto" : "0px",
                        transition: "opacity 0.2s ease, height 0.2s ease",
                      }}>
                        {group}
                      </div>
                    )}
                    <div
                      className="lyric-history-item"
                      onClick={() => { restoreComposition(comp); setHistoryPanelOpen(false) }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: historyPanelOpen ? "7px 10px 7px 16px" : "9px 0 9px 18px",
                        justifyContent: "flex-start",
                        cursor: "pointer",
                        transition: "background 0.12s, padding 0.3s",
                      }}
                    >
                      {/* Voice gradient dot — always visible */}
                      <div style={{
                        width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                        background: voice
                          ? "linear-gradient(135deg, " + voice.gradientFrom + ", " + voice.gradientTo + ")"
                          : "linear-gradient(135deg, #c9a96e, #9c958f)",
                        transition: "transform 0.2s ease",
                        transform: historyPanelOpen ? "scale(1)" : "scale(0.85)",
                      }} />

                      {/* Text preview — visible when expanded */}
                      <p style={{
                        fontSize: "13px", color: "#2a2622", margin: 0, lineHeight: 1.35,
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                        opacity: historyPanelOpen ? 1 : 0,
                        transition: "opacity 0.15s ease 0.05s",
                      }}>
                        {preview}
                      </p>

                      {/* Delete icon — appears on item hover when expanded */}
                      {historyPanelOpen && (
                        <button
                          className="lyric-history-delete"
                          onClick={(e) => { e.stopPropagation(); deleteComposition(comp.id) }}
                          style={{
                            flexShrink: 0,
                            width: "22px", height: "22px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "none", border: "none",
                            color: "#d4cfc9", cursor: "pointer",
                            fontSize: "13px", lineHeight: 1,
                            borderRadius: "5px",
                            transition: "color 0.12s, background 0.12s, opacity 0.12s",
                            opacity: 0,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* ── Floating Voice Panel (right side) ──────────────────────────── */}
      <div style={{
        position: "fixed",
        right: voicePanelOpen ? "16px" : "-282px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        transition: "right 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Edge tab handle (always visible, attached to panel left edge) */}
        <button
          className="lyric-panel-tab"
          onClick={() => setVoicePanelOpen(!voicePanelOpen)}
          style={{
            width: "36px",
            height: "72px",
            borderRadius: "10px 0 0 10px",
            background: "#ffffff",
            border: "1px solid #eae4de",
            borderRight: "none",
            boxShadow: "-4px 0 12px rgba(42,38,34,0.05)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          <div style={{
            width: "10px", height: "10px", borderRadius: "50%",
            background: `linear-gradient(135deg, ${activeVoice.gradientFrom}, ${activeVoice.gradientTo})`,
          }} />
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#756d65" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: "transform 0.3s ease",
              transform: voicePanelOpen ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Panel body */}
        <div style={{
          width: "280px",
          maxHeight: "calc(100vh - 120px)",
          background: "#ffffff",
          border: "1px solid #eae4de",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(42,38,34,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}>
        {/* Panel header */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #eae4de",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
            color: "#b5aca3", textTransform: "uppercase",
          }}>
            Edition 01
          </span>
        </div>

        {/* Voice list (scrollable) */}
        <div className="lyric-voice-panel-scroll" style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
        }}>
          {voices.map((voice) => {
            const isActive = activeVoice.id === voice.id
            return (
              <div key={voice.id}>
                {/* Voice card header (always visible) */}
                <button
                  className="lyric-vp-card"
                  onClick={() => selectVoice(voice)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 16px",
                    background: isActive ? "rgba(234,228,222,0.4)" : "transparent",
                    border: "none",
                    borderLeft: isActive ? "2px solid #B8955A" : "2px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#2a2622",
                  }}
                >
                  {/* Gradient dot */}
                  <div style={{
                    width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#2a2622" : "#756d65",
                    }}>
                      {voice.title.split("\u00b7")[0].trim()}
                    </span>
                    <span style={{
                      fontSize: "10px", color: "#b5aca3", marginLeft: "6px",
                      fontWeight: 500, letterSpacing: "0.02em",
                    }}>
                      {voice.archetype}
                    </span>
                  </div>
                </button>

                {/* Expanded details (active voice only) */}
                <div style={{
                  maxHeight: isActive ? "300px" : "0",
                  opacity: isActive ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.25s ease, opacity 0.2s ease",
                }}>
                  <div style={{ padding: "4px 16px 14px 28px" }}>
                    <p style={{ fontSize: "11px", color: "#9c958f", margin: "0 0 12px", lineHeight: 1.5 }}>
                      {voice.blurb}
                    </p>

                    {/* Expression label */}
                    <p style={{
                      fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
                      color: "#b5aca3", textTransform: "uppercase", margin: "0 0 6px",
                    }}>
                      Select Expression
                    </p>

                    {/* Variant pills */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "14px" }}>
                      {voice.intents.map((intent) => {
                        const isActiveIntent = activeVariant === intent
                        return (
                          <button
                            key={intent}
                            className="lyric-vp-expr"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveVariant(intent)
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

                    {/* Play sample */}
                    <button
                      className="lyric-vp-sample"
                      onClick={(e) => { e.stopPropagation(); toggleSamplePlay(voice) }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "4px 10px", borderRadius: "8px",
                        border: "1px solid #d4cfc9", background: "transparent",
                        fontSize: "10px", color: "#756d65", cursor: "pointer",
                        transition: "background 0.12s",
                      }}
                    >
                      {playingSampleId === voice.id ? (
                        <>
                          <svg width="8" height="10" viewBox="0 0 10 12" fill="#756d65">
                            <rect x="0" y="0" width="3.5" height="12" rx="1" />
                            <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
                          </svg>
                          Stop
                        </>
                      ) : (
                        <>
                          <svg width="8" height="10" viewBox="0 0 10 12" fill="#756d65">
                            <path d="M0 0L10 6L0 12V0Z" />
                          </svg>
                          Play sample
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>{/* end panel body */}
      </div>{/* end outer wrapper */}



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


      {/* Change 5: Floating pill player bar */}
      {audioUrl && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 50, width: "480px", maxWidth: "calc(100vw - 48px)",
          background: "#2a2622", borderRadius: "100px",
          padding: "10px 20px 10px 16px",
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
            style={{ flex: 1, minWidth: 0 }}
          />

          {/* Remaining */}
          <span style={{ fontSize: "11px", color: "rgba(248,246,243,0.5)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            -{fmt(Math.max(0, duration - currentTime))}
          </span>

          {/* Inverted action buttons */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
            <ActionButton inverted title="Download" onClick={handleDownload}><Download size={20} strokeWidth={1.5} /></ActionButton>
            <ActionButton inverted title={canGenerate ? "Regenerate" : "Cannot regenerate now"} onClick={generate} disabled={!canGenerate}><RotateCcw size={20} strokeWidth={1.5} /></ActionButton>
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
      data-tip={title}
      className={`${inverted ? "lyric-action-btn-inv" : "lyric-action-btn"} lyric-tip${inverted ? " lyric-tip-up" : ""}`}
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
            border: `1px solid ${dir === currentDirection ? "#B8955A" : "rgba(255,255,255,0.18)"}`,
            background: dir === currentDirection ? "rgba(184,149,90,0.28)" : "transparent",
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

  useEffect(() => {
    if (!canRemove && editorRef.current) {
      editorRef.current.focus()
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
        data-placeholder="Pick a voice, start writing, and highlight any phrase to direct emotion."
        data-first-para={!canRemove ? "true" : undefined}
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
                background: "rgba(184,149,90,0.12)", border: "1px solid rgba(184,149,90,0.3)",
                borderRadius: "100px", padding: "2px 6px 2px 8px",
                fontSize: "10px", color: "#8a6050",
              }}
            >
              {mark.direction}
              <button
                onClick={() => onMarkRemove(mark.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#B8955A", fontSize: "11px", lineHeight: 1, padding: 0 }}
              >×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
