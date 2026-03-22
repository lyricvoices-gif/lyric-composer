"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { getAllVoices, type VoiceDefinition } from "@/lib/voiceData"

// ── Design tokens ────────────────────────────────────────────────────────────
const DARK = "#2b2a25"
const GOLD = "#c9a96e"
const LIGHT = "#f5f3ef"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(245,243,239,0.1)"
const BORDER_HOVER = "rgba(245,243,239,0.25)"

// ── Static data ───────────────────────────────────────────────────────────────

const CATEGORIES: { label: string; sub: string; voiceId: string }[] = [
  { label: "Brand Films & Storytelling",  sub: "Narration, brand docs, audiobooks",       voiceId: "riven-narrator" },
  { label: "Wellness & Coaching",          sub: "Apps, guided content, human-led brands",  voiceId: "nova-intimist" },
  { label: "Enterprise & Finance",         sub: "Corporate, legal, high-trust narration",  voiceId: "morgan-anchor" },
  { label: "Product & Education",          sub: "Tutorials, docs, product walkthroughs",   voiceId: "atlas-guide" },
  { label: "Social & Creator Content",     sub: "Campaigns, ads, bold brand voice",        voiceId: "hex-wildcard" },
]

const VARIANT_TAGLINES: Record<string, Record<string, string>> = {
  "morgan-anchor":  { Authoritative: "Command-level authority", Warm: "Accessible and connected",  Composed: "Steady and measured" },
  "nova-intimist":  { Compassionate: "Present and deeply caring", Encouraging: "Motivating and forward-moving", Calm: "Grounded and unhurried" },
  "atlas-guide":    { Patient: "Clear, unhurried instruction", Clear: "Direct and precise", Supportive: "Alongside you, not ahead" },
  "riven-narrator": { Intrigue: "The hook", Tension: "The pull", Wonder: "The reveal" },
  "hex-wildcard":   { Playful: "Light and irreverent", Ironic: "Sharp and knowing", Bold: "Loud, confident, decisive" },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const router = useRouter()
  const voices = getAllVoices()

  const [step, setStep] = useState(1)
  const [recommendedId, setRecommendedId] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<VoiceDefinition | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingId(null)
  }

  function togglePlay(voice: VoiceDefinition) {
    if (playingId === voice.id) { stopAudio(); return }
    stopAudio()
    const audio = new Audio(voice.sampleUrl)
    audio.onended = () => setPlayingId(null)
    audio.play()
    audioRef.current = audio
    setPlayingId(voice.id)
  }

  function handleCategorySelect(voiceId: string) {
    setRecommendedId(voiceId)
    setStep(2)
  }

  function handleVoiceSelect(voice: VoiceDefinition) {
    stopAudio()
    setSelectedVoice(voice)
    setSelectedVariant(null)
    setStep(3)
  }

  async function handleSubmit() {
    if (!selectedVoice || !selectedVariant || isSubmitting) return
    setIsSubmitting(true)
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice: selectedVoice.id,
          variant: selectedVariant,
          intent: selectedVariant,
        }),
      })
      // Push to /onboarding — the server wrapper calls currentUser() (always fresh)
      // and redirects to /composer once it sees onboarding_complete: true.
      router.push("/composer")
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .ob-card { transition: border-color 0.15s, background 0.15s; }
        .ob-card:hover { border-color: ${BORDER_HOVER} !important; }
        .ob-card.selected { border-color: ${GOLD} !important; }
        .ob-play:hover { opacity: 1 !important; }
        .ob-back:hover { color: ${LIGHT} !important; }
        .ob-submit:not(:disabled):hover { background: #b8916a !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: DARK,
        color: LIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px 96px",
      }}>
        {/* Wordmark */}
        <div style={{ fontFamily: "Agrandir, sans-serif", fontSize: "20px", letterSpacing: "-0.01em", marginBottom: "40px" }}>
          lyric
        </div>

        {/* Step dots */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "56px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              height: "6px",
              borderRadius: "3px",
              background: n === step ? GOLD : n < step ? "rgba(201,169,110,0.35)" : "rgba(245,243,239,0.12)",
              width: n === step ? "20px" : "6px",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* ── Step 1: Use case ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ width: "100%", maxWidth: "640px" }}>
            <p style={{ fontFamily: "Agrandir, sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, margin: "0 0 12px" }}>
              Step 1 of 3
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              What are you building?
            </h1>
            <p style={{ fontSize: "14px", color: MUTED, margin: "0 0 36px", lineHeight: 1.5 }}>
              We'll recommend a voice. You can always change it.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.voiceId}
                  className="ob-card"
                  onClick={() => handleCategorySelect(cat.voiceId)}
                  style={{
                    background: "rgba(245,243,239,0.04)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    color: LIGHT,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.01em", marginBottom: "6px" }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: "12px", color: MUTED, lineHeight: 1.4 }}>
                    {cat.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Voice selection ──────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ width: "100%", maxWidth: "680px" }}>
            <p style={{ fontFamily: "Agrandir, sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, margin: "0 0 12px" }}>
              Step 2 of 3
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              Choose your voice
            </h1>
            <p style={{ fontSize: "14px", color: MUTED, margin: "0 0 36px", lineHeight: 1.5 }}>
              Each voice has its own character. Press play to hear it.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {voices.map((voice) => {
                const isRecommended = voice.id === recommendedId
                return (
                  <button
                    key={voice.id}
                    className="ob-card"
                    onClick={() => handleVoiceSelect(voice)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      background: "rgba(245,243,239,0.04)",
                      border: `1px solid ${isRecommended ? "rgba(201,169,110,0.4)" : BORDER}`,
                      borderRadius: "12px",
                      padding: "16px 20px",
                      cursor: "pointer",
                      color: LIGHT,
                      textAlign: "left",
                    }}
                  >
                    {/* Gradient swatch */}
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                      flexShrink: 0,
                    }} />

                    {/* Name + archetype */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.01em" }}>
                          {voice.title.split("·")[0].trim()}
                        </span>
                        <span style={{ fontSize: "11px", color: MUTED, fontWeight: 500, letterSpacing: "0.04em" }}>
                          {voice.archetype}
                        </span>
                        {isRecommended && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: GOLD,
                            background: "rgba(201,169,110,0.12)",
                            border: "1px solid rgba(201,169,110,0.3)",
                            borderRadius: "4px",
                            padding: "2px 7px",
                          }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: MUTED, lineHeight: 1.4 }}>
                        {voice.blurb}
                      </div>
                    </div>

                    {/* Play button */}
                    <button
                      className="ob-play"
                      onClick={(e) => { e.stopPropagation(); togglePlay(voice) }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        border: `1px solid ${BORDER_HOVER}`,
                        background: "transparent",
                        color: LIGHT,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: playingId === voice.id ? 1 : 0.6,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {playingId === voice.id ? (
                        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                          <rect x="0" y="0" width="3.5" height="12" rx="1" />
                          <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
                        </svg>
                      ) : (
                        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                          <path d="M0 0L10 6L0 12V0Z" />
                        </svg>
                      )}
                    </button>
                  </button>
                )
              })}
            </div>

            <button
              className="ob-back"
              onClick={() => setStep(1)}
              style={{ marginTop: "24px", background: "none", border: "none", color: MUTED, fontSize: "13px", cursor: "pointer", padding: 0 }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step 3: Variant selection ────────────────────────────────────── */}
        {step === 3 && selectedVoice && (
          <div style={{ width: "100%", maxWidth: "640px" }}>
            <p style={{ fontFamily: "Agrandir, sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, margin: "0 0 12px" }}>
              Step 3 of 3
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              Choose your starting tone
            </h1>
            <p style={{ fontSize: "14px", color: MUTED, margin: "0 0 36px", lineHeight: 1.5 }}>
              This sets {selectedVoice.title.split("·")[0].trim()}'s default posture. You can switch anytime in the composer.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "36px" }}>
              {selectedVoice.intents.map((intent) => {
                const isSelected = selectedVariant === intent
                const tagline = VARIANT_TAGLINES[selectedVoice.id]?.[intent] ?? ""
                return (
                  <button
                    key={intent}
                    className={`ob-card${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedVariant(intent)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: isSelected ? "rgba(201,169,110,0.07)" : "rgba(245,243,239,0.04)",
                      border: `1px solid ${isSelected ? GOLD : BORDER}`,
                      borderRadius: "12px",
                      padding: "18px 20px",
                      cursor: "pointer",
                      color: LIGHT,
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.01em", marginBottom: "4px" }}>
                        {intent}
                      </div>
                      <div style={{ fontSize: "12px", color: MUTED }}>
                        {tagline}
                      </div>
                    </div>
                    {isSelected && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7.5" stroke={GOLD} />
                        <path d="M5 8l2 2 4-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              className="ob-submit"
              onClick={handleSubmit}
              disabled={!selectedVariant || isSubmitting}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "100px",
                background: selectedVariant && !isSubmitting ? GOLD : "rgba(201,169,110,0.3)",
                color: selectedVariant && !isSubmitting ? DARK : "rgba(43,42,37,0.5)",
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                border: "none",
                cursor: selectedVariant && !isSubmitting ? "pointer" : "default",
                transition: "background 0.2s",
                marginBottom: "16px",
              }}
            >
              {isSubmitting ? "Launching…" : "Enter the composer →"}
            </button>

            <button
              className="ob-back"
              onClick={() => { stopAudio(); setStep(2) }}
              style={{ background: "none", border: "none", color: MUTED, fontSize: "13px", cursor: "pointer", padding: 0 }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </>
  )
}
