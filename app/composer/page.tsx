"use client"

import { SignedIn, SignedOut, RedirectToSignIn, UserButton, useAuth } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import { getAllVoices, VoiceDefinition } from "@/lib/voiceData"
import { getPlanConfig, remainingGenerations, resolvePlanId } from "@/lib/planConfig"

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
        <RedirectToSignIn />
      </SignedOut>
    </>
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

  // Script
  const [script, setScript] = useState("")

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

  // Usage — optimistic client-side tracking; increments per successful generation.
  // Does not persist across page reloads. A GET /api/usage endpoint can seed this
  // on mount once the usage endpoint is built.
  const [usedToday, setUsedToday] = useState(0)

  // ---------------------------------------------------------------------------
  // Plan — derived from Clerk publicMetadata
  // ---------------------------------------------------------------------------

  // Wait for Clerk to hydrate before computing limits
  const plan = getPlanConfig(isLoaded ? resolvePlanId(has) : undefined)
  const remaining = remainingGenerations(plan, usedToday)
  const isAtLimit = remaining !== null && remaining <= 0

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

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  async function generate() {
    if (!script.trim() || isGenerating || isAtLimit || script.length > plan.maxScriptCharacters) return

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: activeVoice.id,
          variant: activeVariant,
          script: script.trim(),
          direction: {
            mode: "global",
            intent: activeVariant,
          },
          segments: [],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }))
        throw new Error(err.error ?? `Generation failed (${res.status})`)
      }

      const blob = await res.blob()

      // Revoke previous object URL to avoid memory leak
      if (audioUrl) URL.revokeObjectURL(audioUrl)

      const url = URL.createObjectURL(blob)
      setAudioBlob(blob)
      setAudioUrl(url)
      setCurrentTime(0)
      setUsedToday((n) => n + 1)
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
    a.download = `${activeVoice.id}-${activeVariant.toLowerCase()}.mp3`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------------------------------------------------------------------------
  // Audio element event wiring
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

  // Auto-play on new audio
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {})
    }
  }, [audioUrl])

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const isOverScriptLimit = script.length > plan.maxScriptCharacters
  const canGenerate =
    !isGenerating && !isAtLimit && !isOverScriptLimit && script.trim().length > 0

  function fmt(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-zinc-900 shrink-0">
        <span className="text-xs font-medium tracking-[0.2em] text-zinc-400 uppercase">
          Lyric
        </span>
        <div className="flex items-center gap-5">
          {!isLoaded ? null : remaining === null ? (
            <span className="text-xs text-zinc-600">Unlimited · Enterprise</span>
          ) : (
            <span className={`text-xs tabular-nums ${remaining <= 3 ? "text-amber-400" : "text-zinc-600"}`}>
              {remaining} generation{remaining !== 1 ? "s" : ""} left today
            </span>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar — Voice selector ────────────────────────────────────── */}
        <aside className="w-48 shrink-0 border-r border-zinc-900 overflow-y-auto p-3 flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-700 px-1 mb-1">Voice</p>
          {voices.map((voice) => (
            <button
              key={voice.id}
              onClick={() => selectVoice(voice)}
              className={`relative rounded-lg p-3 text-left transition-all duration-150 ${
                activeVoice.id === voice.id
                  ? "ring-1 ring-white/30 shadow-md"
                  : "opacity-50 hover:opacity-70"
              }`}
              style={{
                background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
              }}
            >
              <p className="text-[11px] font-semibold text-black/75 leading-tight truncate">
                {voice.title}
              </p>
              <p className="text-[10px] text-black/45 mt-0.5">{voice.archetype}</p>
            </button>
          ))}
        </aside>

        {/* ── Main ───────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8 flex flex-col gap-7">

            {/* Voice header */}
            <div className="flex flex-col gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">{activeVoice.title}</h1>
                <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{activeVoice.blurb}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeVoice.verticals.map((v) => (
                  <span
                    key={v}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-600 border border-zinc-800"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Base Posture (variant selector) ─────────────────────────── */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-700 mb-2">
                Base Posture
              </p>
              <div className="flex gap-2 flex-wrap">
                {activeVoice.intents.map((intent) => (
                  <button
                    key={intent}
                    onClick={() => setActiveVariant(intent)}
                    className={`px-4 py-1.5 rounded-full text-xs border transition-all ${
                      activeVariant === intent
                        ? "bg-white text-black border-white"
                        : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Direction palette ────────────────────────────────────────── */}
            <div className="border border-zinc-900 rounded-xl p-4 flex flex-col gap-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-700">
                Direction Palette
              </p>
              {activeVoice.palette.emotionGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] text-zinc-700 mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => {
                      const isActiveVariant =
                        item.type === "variant" && item.value === activeVariant
                      const isEmotion = item.type === "emotion"
                      return (
                        <button
                          key={item.value}
                          onClick={() => {
                            if (item.type === "variant") setActiveVariant(item.value)
                          }}
                          disabled={isEmotion}
                          title={
                            isEmotion
                              ? "Inline emotion tag — Layer 2 direction (coming soon)"
                              : undefined
                          }
                          className={`px-3 py-1 rounded-full text-xs border transition-all ${
                            isActiveVariant
                              ? "bg-white text-black border-white"
                              : isEmotion
                              ? "bg-transparent text-zinc-700 border-zinc-900 cursor-default"
                              : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 cursor-pointer"
                          }`}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Script editor ───────────────────────────────────────────── */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-[10px] uppercase tracking-widest text-zinc-700">Script</p>
                <span
                  className={`text-xs tabular-nums ${
                    isOverScriptLimit ? "text-red-400" : "text-zinc-700"
                  }`}
                >
                  {script.length} / {plan.maxScriptCharacters}
                </span>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                className="w-full bg-zinc-900/40 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 resize-none focus:outline-none focus:border-zinc-600 transition-colors leading-relaxed"
                placeholder="Write your script here…"
              />
              {isOverScriptLimit && (
                <p className="text-xs text-red-400 mt-1.5">
                  Script exceeds {plan.label} plan limit ({plan.maxScriptCharacters} chars).
                  Upgrade to write longer scripts.
                </p>
              )}
            </div>

            {/* Error */}
            {generationError && (
              <p className="text-xs text-red-400 leading-relaxed">{generationError}</p>
            )}

            {/* ── Generate button ──────────────────────────────────────────── */}
            <button
              onClick={generate}
              disabled={!canGenerate}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                canGenerate
                  ? "bg-white text-black hover:bg-zinc-100 active:bg-zinc-200"
                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {isGenerating
                ? "Generating…"
                : isAtLimit
                ? "Daily limit reached — resets at midnight UTC"
                : "Generate"}
            </button>

            {/* ── Player bar ───────────────────────────────────────────────── */}
            {audioUrl && (
              <div className="border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />

                {/* Play / Pause */}
                <button
                  onClick={togglePlay}
                  className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-xs shrink-0 hover:bg-zinc-200 transition-colors"
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                {/* Current time */}
                <span className="text-xs text-zinc-600 w-9 shrink-0 tabular-nums">
                  {fmt(currentTime)}
                </span>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.01}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-white h-0.5 cursor-pointer"
                />

                {/* Duration */}
                <span className="text-xs text-zinc-600 w-9 shrink-0 tabular-nums text-right">
                  {fmt(duration)}
                </span>

                {/* Regenerate */}
                <button
                  onClick={generate}
                  disabled={!canGenerate}
                  title="Regenerate"
                  className={`text-base px-1 transition-colors ${
                    canGenerate
                      ? "text-zinc-500 hover:text-white"
                      : "text-zinc-800 cursor-not-allowed"
                  }`}
                >
                  ↺
                </button>

                {/* Download */}
                <button
                  onClick={handleDownload}
                  title="Download MP3"
                  className="text-base px-1 text-zinc-500 hover:text-white transition-colors"
                >
                  ↓
                </button>
              </div>
            )}

            {/* ── Guardrail ────────────────────────────────────────────────── */}
            <p className="text-[10px] text-zinc-800 leading-relaxed">
              <span className="text-zinc-700">Guardrail · </span>
              {activeVoice.guardrail}
            </p>

          </div>
        </main>
      </div>
    </div>
  )
}
