"use client"

import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect, useCallback } from "react"
import { getAllVoices, VoiceDefinition } from "@/lib/voiceData"
import { getPlanConfig, remainingGenerations, resolvePlanId, hasPaidPlan } from "@/lib/planConfig"

const FRAMER_URL = "https://formal-organization-793965.framer.app"

const DIRECTIONS = [
  "Conversational", "Intimate", "Authoritative", "Playful",
  "Contemplative", "Warm", "Urgent", "Reassuring",
  "Emphasis", "Pause", "Soft", "Confident", "Clear", "Smile",
]

interface Paragraph {
  id: string
  text: string
  direction: string
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
// Page — Clerk gate
// ---------------------------------------------------------------------------

export default function ComposerPage() {
  return (
    <>
      <SignedIn>
        <Composer />
      </SignedIn>
      <SignedOut>
        <FramerRedirect />
      </SignedOut>
    </>
  )
}

function FramerRedirect() {
  useEffect(() => {
    window.location.replace(FRAMER_URL)
  }, [])
  return null
}

function NoPlanWall() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#b5aca3", textTransform: "uppercase", marginBottom: "40px" }}>
        Lyric
      </p>
      <div style={{ maxWidth: "320px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em", color: "#2a2622" }}>
          Composer requires a plan
        </h1>
        <p style={{ fontSize: "14px", color: "#756d65", lineHeight: 1.6 }}>
          Lyric Composer is available on Creator, Studio, and Enterprise plans.
        </p>
        <a
          href="/upgrade"
          style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: "12px", background: "#2a2622", color: "#f8f6f3", fontSize: "14px", fontWeight: 500, textDecoration: "none" }}
        >
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

  // Paragraphs
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([
    { id: crypto.randomUUID(), text: "", direction: "Conversational" },
  ])
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

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
  // Plan — derived from Clerk Billing (unchanged)
  // ---------------------------------------------------------------------------

  const plan = getPlanConfig(isLoaded ? resolvePlanId(has) : undefined)
  const remaining = remainingGenerations(plan, usedToday)
  const isAtLimit = remaining !== null && remaining <= 0

  // ---------------------------------------------------------------------------
  // Derived script
  // ---------------------------------------------------------------------------

  const assembledScript = paragraphs.map((p) => p.text).join("\n\n").trim()
  const isOverScriptLimit = assembledScript.length > plan.maxScriptCharacters
  const canGenerate =
    !isGenerating && !isAtLimit && !isOverScriptLimit && assembledScript.length > 0

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
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause()
    }
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
      { id: crypto.randomUUID(), text: "", direction: "Conversational" },
    ])
  }

  function updateParagraphText(id: string, text: string) {
    setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)))
  }

  function updateParagraphDirection(id: string, direction: string) {
    setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, direction } : p)))
    setOpenPopoverId(null)
  }

  function removeParagraph(id: string) {
    setParagraphs((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((p) => p.id !== id)
    })
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
  // Generation (core logic unchanged — additive only)
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
          direction: {
            mode: "global",
            intent: activeVariant,
          },
          segments: paragraphs.map((p) => ({ text: p.text, emotion: p.direction })),
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

      // Auto-save (fire and forget)
      saveComposition().catch((err) => console.error("[auto-save]", err))
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Player controls (unchanged)
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
      if (res.ok) {
        const data = await res.json()
        setCompositions(data)
      }
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
    if (voice) {
      setActiveVoice(voice)
      setActiveVariant(comp.variant)
    }
    if (comp.directions && comp.directions.length > 0) {
      setParagraphs(comp.directions)
    } else {
      setParagraphs([{ id: crypto.randomUUID(), text: comp.script, direction: "Conversational" }])
    }
    setAudioUrl(null)
    setAudioBlob(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setGenerationError(null)
    setSidebarOpen(false)
  }

  function handleNewComposition() {
    if (
      assembledScript.trim() &&
      !confirm("Start a new composition? Your current script will be cleared.")
    ) return
    setParagraphs([{ id: crypto.randomUUID(), text: "", direction: "Conversational" }])
    setAudioUrl(null)
    setAudioBlob(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setGenerationError(null)
  }

  // ---------------------------------------------------------------------------
  // Click-outside: popover
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!openPopoverId) return
    function onMouseDown(e: MouseEvent) {
      const popover = document.getElementById(`popover-${openPopoverId}`)
      if (popover && !popover.contains(e.target as Node)) {
        setOpenPopoverId(null)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [openPopoverId])

  // Click-outside: sidebar
  useEffect(() => {
    if (!sidebarOpen) return
    function onMouseDown(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [sidebarOpen])

  // ---------------------------------------------------------------------------
  // Audio event wiring (unchanged)
  // ---------------------------------------------------------------------------

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

  // No-plan gate — must come after all hooks
  if (isLoaded && !hasPaidPlan(has)) {
    return <NoPlanWall />
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f3", display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Hidden main audio element */}
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" style={{ display: "none" }} />

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
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
              <span style={{
                fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em",
                padding: "2px 8px", borderRadius: "100px",
                background: "#eae4de", color: "#756d65", textTransform: "uppercase",
              }}>
                {plan.label}
              </span>
            </>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* ── Layout ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* ── Left edge rail ──────────────────────────────────────────────── */}
        <div style={{
          width: "52px", flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: "20px", gap: "20px",
          borderRight: "1px solid #eae4de",
        }}>
          <button
            onClick={openSidebar}
            title="History"
            style={{
              width: "32px", height: "32px", borderRadius: "8px", border: "none",
              background: sidebarOpen ? "#eae4de" : "transparent",
              color: "#9c958f", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px", transition: "background 0.15s",
            }}
          >
            ◷
          </button>
          <button
            title="Projects — coming soon for Studio & Enterprise"
            disabled
            style={{
              width: "32px", height: "32px", borderRadius: "8px", border: "none",
              background: "transparent", color: "#d4cfc9", cursor: "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
            }}
          >
            ⬚
          </button>
        </div>

        {/* ── Main canvas ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 24px 180px" }}>
          <div style={{ maxWidth: "940px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

            {/* ── Voice selector ──────────────────────────────────────────── */}
            <section>
              <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", color: "#b5aca3", textTransform: "uppercase", margin: "0 0 12px" }}>
                Voice
              </p>
              <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
                {voices.map((voice) => {
                  const isActive = activeVoice.id === voice.id
                  return (
                    <div
                      key={voice.id}
                      onClick={() => selectVoice(voice)}
                      style={{
                        flexShrink: 0, width: "180px", borderRadius: "14px",
                        background: "#ffffff",
                        border: `1.5px solid ${isActive ? "#c4977f" : "#eae4de"}`,
                        overflow: "hidden", cursor: "pointer",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxShadow: isActive ? "0 2px 12px rgba(196,151,127,0.15)" : "none",
                      }}
                    >
                      {/* Gradient swatch with sample play */}
                      <div style={{
                        height: "72px", position: "relative",
                        background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSamplePlay(voice) }}
                          title="Preview sample"
                          style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: "rgba(255,255,255,0.85)", border: "none",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "13px", color: "#2a2622",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                          }}
                        >
                          {playingSampleId === voice.id ? "⏸" : "▶"}
                        </button>
                      </div>

                      {/* Info */}
                      <div style={{ padding: "12px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: "0 0 2px" }}>
                          {voice.title}
                        </p>
                        <p style={{ fontSize: "11px", color: "#9c958f", margin: 0 }}>
                          {voice.archetype}
                        </p>

                        {/* Variant pills — only on active card */}
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
              </div>
            </section>

            {/* ── Action bar ──────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
              <span style={{
                fontSize: "11px", fontVariantNumeric: "tabular-nums",
                color: isOverScriptLimit ? "#c4722a" : "#b5aca3",
              }}>
                {assembledScript.length} / {plan.maxScriptCharacters}
              </span>
            </div>

            {/* Inline messages */}
            {isOverScriptLimit && (
              <p style={{ fontSize: "12px", color: "#c4722a", margin: "-20px 0 0" }}>
                Script exceeds {plan.label} plan limit ({plan.maxScriptCharacters} chars). Upgrade to write longer scripts.
              </p>
            )}
            {isAtLimit && !isOverScriptLimit && (
              <p style={{ fontSize: "12px", color: "#c4722a", margin: "-20px 0 0" }}>
                Daily limit reached — resets at midnight UTC.
              </p>
            )}
            {generationError && (
              <p style={{ fontSize: "12px", color: "#c4722a", margin: "-20px 0 0" }}>
                {generationError}
              </p>
            )}

            {/* ── Paragraph editor ────────────────────────────────────────── */}
            <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {paragraphs.map((para) => (
                <ParagraphBlock
                  key={para.id}
                  para={para}
                  openPopoverId={openPopoverId}
                  onTextChange={(text) => updateParagraphText(para.id, text)}
                  onDirectionChange={(dir) => updateParagraphDirection(para.id, dir)}
                  onOpenPopover={() => setOpenPopoverId(para.id)}
                  onRemove={() => removeParagraph(para.id)}
                  canRemove={paragraphs.length > 1}
                />
              ))}
              <button
                onClick={addParagraph}
                style={{
                  alignSelf: "flex-start", padding: "6px 14px", borderRadius: "8px",
                  border: "1.5px dashed #d4cfc9", background: "transparent",
                  fontSize: "12px", color: "#9c958f", cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                + paragraph
              </button>
            </section>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={!canGenerate}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                fontSize: "14px", fontWeight: 500,
                cursor: canGenerate ? "pointer" : "not-allowed",
                background: canGenerate ? "#2a2622" : "#eae4de",
                color: canGenerate ? "#f8f6f3" : "#b5aca3",
                transition: "all 0.15s",
              }}
            >
              {isGenerating
                ? "Generating…"
                : isAtLimit
                ? "Daily limit reached — resets at midnight UTC"
                : "Generate"}
            </button>

            {/* Guardrail */}
            <p style={{ fontSize: "11px", color: "#b5aca3", lineHeight: 1.6 }}>
              <span style={{ color: "#9c958f" }}>Guardrail · </span>
              {activeVoice.guardrail}
            </p>

          </div>
        </main>
      </div>

      {/* ── History sidebar ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          ref={sidebarRef}
          style={{
            position: "fixed", top: 0, left: "52px", bottom: 0, width: "300px", zIndex: 100,
            background: "#ffffff", borderRight: "1px solid #eae4de",
            display: "flex", flexDirection: "column",
            boxShadow: "4px 0 24px rgba(42,38,34,0.08)",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eae4de", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: 0 }}>History</p>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: "none", border: "none", color: "#9c958f", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 2px" }}
            >
              ×
            </button>
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
                      style={{
                        borderRadius: "10px", border: "1px solid #eae4de",
                        padding: "10px 12px", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: "4px",
                      }}
                    >
                      {voice && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{
                            width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                            background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                          }} />
                          <span style={{ fontSize: "10px", fontWeight: 600, color: "#756d65" }}>
                            {voice.archetype} · {comp.variant}
                          </span>
                        </div>
                      )}
                      <p style={{ fontSize: "12px", color: "#2a2622", margin: 0, lineHeight: 1.4 }}>
                        {preview}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <span style={{ fontSize: "10px", color: "#b5aca3" }}>{date}</span>
                        {comp.duration_s != null && (
                          <span style={{ fontSize: "10px", color: "#b5aca3" }}>{fmt(comp.duration_s)}</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteComposition(comp.id) }}
                          title="Delete"
                          style={{ background: "none", border: "none", color: "#d4cfc9", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "2px" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed player bar ────────────────────────────────────────────── */}
      {audioUrl && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: "12px 24px",
          background: "rgba(248,246,243,0.96)", backdropFilter: "blur(16px)",
          borderTop: "1px solid #eae4de",
          display: "flex", alignItems: "center", gap: "16px",
        }}>
          {/* Voice swatch + info */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "160px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
              background: `linear-gradient(135deg, ${activeVoice.gradientFrom}, ${activeVoice.gradientTo})`,
            }} />
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#2a2622", margin: 0, lineHeight: 1.2 }}>
                {activeVoice.archetype}
              </p>
              <p style={{ fontSize: "10px", color: "#9c958f", margin: 0 }}>{activeVariant}</p>
            </div>
          </div>

          {/* Playback controls */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={togglePlay}
              style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "#2a2622", color: "#f8f6f3", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", cursor: "pointer", flexShrink: 0,
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <span style={{ fontSize: "11px", color: "#9c958f", fontVariantNumeric: "tabular-nums", width: "36px" }}>
              {fmt(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              style={{ flex: 1, accentColor: "#2a2622", height: "2px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "11px", color: "#9c958f", fontVariantNumeric: "tabular-nums", width: "36px", textAlign: "right" }}>
              {fmt(duration)}
            </span>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ActionButton title="Download" onClick={handleDownload}>↓</ActionButton>
            <ActionButton
              title={canGenerate ? "Regenerate" : "Cannot regenerate now"}
              onClick={generate}
              disabled={!canGenerate}
            >
              ↺
            </ActionButton>
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
  children,
  title,
  onClick,
  disabled = false,
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
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        border: "1.5px solid #eae4de", background: "transparent",
        color: disabled ? "#d4cfc9" : "#756d65",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "15px", transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  )
}

function ParagraphBlock({
  para,
  openPopoverId,
  onTextChange,
  onDirectionChange,
  onOpenPopover,
  onRemove,
  canRemove,
}: {
  para: Paragraph
  openPopoverId: string | null
  onTextChange: (text: string) => void
  onDirectionChange: (direction: string) => void
  onOpenPopover: () => void
  onRemove: () => void
  canRemove: boolean
}) {
  const isOpen = openPopoverId === para.id

  return (
    <div style={{ position: "relative" }}>
      {/* Direction chip row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <button
          onClick={onOpenPopover}
          style={{
            padding: "3px 10px", borderRadius: "100px",
            border: "1.5px solid #eae4de", background: "#ffffff",
            fontSize: "10px", fontWeight: 600, color: "#756d65",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
          }}
        >
          {para.direction}
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove paragraph"
            style={{
              width: "18px", height: "18px", borderRadius: "50%", border: "none",
              background: "transparent", color: "#d4cfc9", cursor: "pointer",
              fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Direction popover */}
      {isOpen && (
        <div
          id={`popover-${para.id}`}
          style={{
            position: "absolute", top: "30px", left: 0, zIndex: 200,
            background: "#ffffff", border: "1px solid #eae4de",
            borderRadius: "12px", padding: "12px",
            boxShadow: "0 8px 24px rgba(42,38,34,0.12)",
            display: "flex", flexWrap: "wrap", gap: "6px",
            width: "280px",
          }}
        >
          {DIRECTIONS.map((dir) => (
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

      {/* Textarea */}
      <textarea
        value={para.text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={3}
        placeholder="Write your script here…"
        style={{
          width: "100%", boxSizing: "border-box",
          background: "#ffffff", border: "1.5px solid #eae4de",
          borderRadius: "12px", padding: "14px 16px",
          fontSize: "20px", lineHeight: "1.75",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#2a2622", resize: "vertical",
          outline: "none", transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#c4977f" }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#eae4de" }}
      />
    </div>
  )
}
