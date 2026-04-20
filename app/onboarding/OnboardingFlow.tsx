"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAllVoices, type VoiceDefinition } from "@/lib/voiceData"
import Wordmark from "@/components/Wordmark"

// ── Design tokens ────────────────────────────────────────────────────────────
const DARK = "#2b2a25"
const GOLD = "#c9a96e"
const LIGHT = "#f5f3ef"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(245,243,239,0.1)"
const BORDER_HOVER = "rgba(245,243,239,0.25)"

// ── Emotion mark styles (matches composer exactly) ──────────────────────────
const MARK_BG = "rgba(184,149,90,0.15)"
const PILL_BG = "rgba(184,149,90,0.18)"
const PILL_BORDER = "rgba(184,149,90,0.35)"
const PILL_COLOR = "#c9a96e"

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

// ── Isotype SVG component ───────────────────────────────────────────────────
function Isotype({ height = 24, color = LIGHT, opacity = 0.18 }: { height?: number; color?: string; opacity?: number }) {
  const width = height // square viewBox
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width={width} height={height} style={{ display: "block", opacity }}>
      <path fill={color} d="m100,500c0,220.89,179.11,400,400,400h400v-200h-400c-110.44,0-200-89.56-200-200v-200H100v200Z"/>
      <polygon fill={color} points="900 500 900 100 300 100 300 300 700 300 700 500 900 500"/>
    </svg>
  )
}

// ── Inline emotion mark (matches composer ::after pattern) ──────────────────
function EmotionMark({ text, direction, visible }: { text: string; direction: string; visible: boolean }) {
  return (
    <span style={{
      background: visible ? MARK_BG : "transparent",
      borderRadius: "3px",
      padding: "1px 0",
      transition: "background 0.6s ease",
    }}>
      {text}
      <span style={{
        display: "inline-block",
        fontSize: "9px",
        background: PILL_BG,
        border: `1px solid ${PILL_BORDER}`,
        color: PILL_COLOR,
        borderRadius: "100px",
        padding: "0 5px",
        marginLeft: "3px",
        verticalAlign: "middle",
        lineHeight: "1.7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-4px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}>
        {direction}
      </span>
    </span>
  )
}

// ── Step transition wrapper ─────────────────────────────────────────────────
function StepContent({ children, stepKey }: { children: React.ReactNode; stepKey: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => { cancelAnimationFrame(t); setMounted(false) }
  }, [stepKey])

  return (
    <div style={{
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {children}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

function trackOnboardingStep(step: number, isRevisit: boolean) {
  fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "track_step", step, isRevisit }),
  }).catch(() => {})
}

export default function OnboardingFlow({ isRevisit = false }: { isRevisit?: boolean }) {
  const router = useRouter()
  const voices = getAllVoices()

  const [step, setStep] = useState(1)

  // Track each step the user lands on (first-time vs revisit differentiated on server)
  useEffect(() => {
    trackOnboardingStep(step, isRevisit)
  }, [step, isRevisit])
  const [recommendedId, setRecommendedId] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<VoiceDefinition | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Demo animation phases for Step 2
  const [demoPhase, setDemoPhase] = useState(0)

  useEffect(() => {
    if (step !== 2) { setDemoPhase(0); return }
    const t1 = setTimeout(() => setDemoPhase(1), 1200)   // highlight appears
    const t2 = setTimeout(() => setDemoPhase(2), 2600)   // emotion pill appears
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [step])

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

  function goToStep(n: number) {
    if (n < step) stopAudio()
    setStep(n)
  }

  function handleCategorySelect(voiceId: string) {
    setRecommendedId(voiceId)
    setStep(4)
  }

  function handleVoiceSelect(voice: VoiceDefinition) {
    stopAudio()
    setSelectedVoice(voice)
    setSelectedVariant(null)
    setStep(5)
  }

  async function handleSubmit() {
    if (!selectedVoice || !selectedVariant || isSubmitting) return
    handleSubmitDirect(selectedVoice, selectedVariant)
  }

  async function handleSubmitDirect(voice: VoiceDefinition, variant: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice: voice.id,
          variant,
          intent: variant,
          isRevisit,
        }),
      })
      router.push(`/?voice=${encodeURIComponent(voice.id)}&variant=${encodeURIComponent(variant)}`)
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes ob-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ob-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(201,169,110,0.3); }
          70% { box-shadow: 0 0 0 6px rgba(201,169,110,0); }
          100% { box-shadow: 0 0 0 0 rgba(201,169,110,0); }
        }
        .ob-card {
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
        }
        .ob-card:hover {
          border-color: ${BORDER_HOVER} !important;
          transform: translateY(-1px);
        }
        .ob-card:active {
          transform: translateY(0) scale(0.99);
        }
        .ob-card.selected {
          border-color: ${GOLD} !important;
        }
        .ob-play {
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .ob-play:hover {
          opacity: 1 !important;
          transform: scale(1.08);
        }
        .ob-play:active {
          transform: scale(0.95);
        }
        .ob-play.playing {
          animation: ob-pulse-ring 1.5s ease infinite;
        }
        .ob-back {
          transition: color 0.2s ease;
        }
        .ob-back:hover {
          color: ${LIGHT} !important;
        }
        .ob-submit {
          transition: background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
        }
        .ob-submit:not(:disabled):hover {
          background: #b8916a !important;
          box-shadow: 0 4px 20px rgba(201,169,110,0.25);
        }
        .ob-submit:not(:disabled):active {
          transform: scale(0.98);
        }
        .ob-cta {
          transition: background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
        }
        .ob-cta:hover {
          background: #b8916a !important;
          box-shadow: 0 4px 20px rgba(201,169,110,0.25);
        }
        .ob-cta:active {
          transform: scale(0.98);
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: DARK,
        color: LIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 24px",
        position: "relative",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {/* Wordmark at top center */}
        <div style={{ paddingTop: "48px", marginBottom: "24px", animation: "ob-fade-up 0.6s ease backwards" }}>
          <Wordmark height={32} color={LIGHT} />
        </div>

        {/* Step dots */}
        <div style={{
          display: "flex",
          gap: "6px",
          alignItems: "center",
          marginBottom: "0",
          animation: "ob-fade-up 0.6s ease 0.1s backwards",
        }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <div key={n} style={{
              height: "5px",
              borderRadius: "3px",
              background: n === step ? GOLD : n < step ? "rgba(201,169,110,0.35)" : "rgba(245,243,239,0.1)",
              width: n === step ? "20px" : "5px",
              transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
            }} />
          ))}
        </div>

        {/* Vertically centered content area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          paddingBottom: "120px",
        }}>

        {/* ── Step 1: Welcome ──────────────────────────────────────────────── */}
        {step === 1 && (
          <StepContent stepKey={1}>
            <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
              <h1 style={{
                fontSize: "36px",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
                lineHeight: 1.2,
                animation: "ob-fade-up 0.6s ease 0.15s backwards",
              }}>
                Welcome to Lyric
              </h1>
              <p style={{
                fontSize: "15px",
                color: MUTED,
                margin: "0 0 48px",
                lineHeight: 1.6,
                animation: "ob-fade-up 0.6s ease 0.3s backwards",
              }}>
                Write your script. Highlight a phrase. Apply emotion to direct your voice. That is the Lyric workflow.
              </p>

              <button
                className="ob-cta"
                onClick={() => setStep(2)}
                style={{
                  padding: "14px 48px",
                  borderRadius: "100px",
                  background: GOLD,
                  color: DARK,
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  border: "none",
                  cursor: "pointer",
                  animation: "ob-fade-up 0.6s ease 0.45s backwards",
                }}
              >
                Get started
              </button>
            </div>
          </StepContent>
        )}

        {/* ── Step 2: Voice Direction Demo ────────────────────────────────── */}
        {step === 2 && (
          <StepContent stepKey={2}>
            <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
              <p style={{
                fontFamily: "Agrandir, sans-serif",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                margin: "0 0 12px",
              }}>
                How it works
              </p>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
              }}>
                Highlight. Direct. Listen.
              </h1>
              <p style={{
                fontSize: "14px",
                color: MUTED,
                margin: "0 0 36px",
                lineHeight: 1.5,
              }}>
                Select a phrase in your script and apply an emotion. The voice shapes its delivery to match.
              </p>

              {/* Demo script area */}
              <div style={{
                background: "rgba(245,243,239,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "14px",
                padding: "28px 24px",
                marginBottom: "32px",
                textAlign: "left",
              }}>
                {/* Demo sentence with animated highlight + emotion pill */}
                <p style={{
                  fontSize: "16px",
                  lineHeight: 1.7,
                  margin: 0,
                  color: LIGHT,
                }}>
                  The future of voice is not about sounding human.{" "}
                  <EmotionMark
                    text="It is about sounding intentional."
                    direction="Warmth"
                    visible={demoPhase >= 2}
                  />
                </p>
              </div>

              <button
                className="ob-cta"
                onClick={() => setStep(3)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "100px",
                  background: GOLD,
                  color: DARK,
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  border: "none",
                  cursor: "pointer",
                  opacity: demoPhase >= 2 ? 1 : 0.4,
                  pointerEvents: demoPhase >= 2 ? "auto" : "none",
                  transition: "opacity 0.4s ease",
                }}
              >
                Continue
              </button>

              <button
                className="ob-back"
                onClick={() => goToStep(1)}
                style={{
                  marginTop: "16px",
                  background: "none",
                  border: "none",
                  color: MUTED,
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                &larr; Back
              </button>
            </div>
          </StepContent>
        )}

        {/* ── Step 3: Use case ─────────────────────────────────────────────── */}
        {step === 3 && (
          <StepContent stepKey={3}>
            <div style={{ width: "100%", maxWidth: "640px" }}>
              <p style={{
                fontFamily: "Agrandir, sans-serif",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                margin: "0 0 12px",
              }}>
                Step 1 of 3
              </p>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
              }}>
                What are you creating?
              </h1>
              <p style={{
                fontSize: "14px",
                color: MUTED,
                margin: "0 0 36px",
                lineHeight: 1.5,
              }}>
                We will recommend a voice. You can always change it later.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {CATEGORIES.map((cat, i) => (
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
                      animation: `ob-fade-up 0.4s ease ${0.05 * i}s backwards`,
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

              <button
                className="ob-back"
                onClick={() => goToStep(2)}
                style={{
                  marginTop: "24px",
                  background: "none",
                  border: "none",
                  color: MUTED,
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                &larr; Back
              </button>
            </div>
          </StepContent>
        )}

        {/* ── Step 4: Voice selection ──────────────────────────────────────── */}
        {step === 4 && (
          <StepContent stepKey={4}>
            <div style={{ width: "100%", maxWidth: "680px" }}>
              <p style={{
                fontFamily: "Agrandir, sans-serif",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                margin: "0 0 12px",
              }}>
                Step 2 of 3
              </p>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
              }}>
                Choose your voice
              </h1>
              <p style={{
                fontSize: "14px",
                color: MUTED,
                margin: "0 0 36px",
                lineHeight: 1.5,
              }}>
                Each voice has its own character. Press play to hear it.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {voices.map((voice, i) => {
                  const isRecommended = voice.id === recommendedId
                  const isPlaying = playingId === voice.id
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
                        animation: `ob-fade-up 0.4s ease ${0.06 * i}s backwards`,
                      }}
                    >
                      {/* Gradient swatch */}
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        background: `linear-gradient(135deg, ${voice.gradientFrom}, ${voice.gradientTo})`,
                        flexShrink: 0,
                        transition: "transform 0.2s ease",
                      }} />

                      {/* Name + archetype */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.01em" }}>
                            {voice.title.split("\u00b7")[0].trim()}
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
                        className={`ob-play${isPlaying ? " playing" : ""}`}
                        onClick={(e) => { e.stopPropagation(); togglePlay(voice) }}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          border: `1px solid ${isPlaying ? GOLD : BORDER_HOVER}`,
                          background: isPlaying ? "rgba(201,169,110,0.1)" : "transparent",
                          color: LIGHT,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          opacity: isPlaying ? 1 : 0.6,
                        }}
                      >
                        {isPlaying ? (
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
                onClick={() => goToStep(3)}
                style={{
                  marginTop: "24px",
                  background: "none",
                  border: "none",
                  color: MUTED,
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                &larr; Back
              </button>
            </div>
          </StepContent>
        )}

        {/* ── Step 5: Variant selection ────────────────────────────────────── */}
        {step === 5 && selectedVoice && (
          <StepContent stepKey={5}>
            <div style={{ width: "100%", maxWidth: "640px" }}>
              <p style={{
                fontFamily: "Agrandir, sans-serif",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                margin: "0 0 12px",
              }}>
                Step 3 of 3
              </p>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
              }}>
                Set your starting tone
              </h1>
              <p style={{
                fontSize: "14px",
                color: MUTED,
                margin: "0 0 36px",
                lineHeight: 1.5,
              }}>
                This sets {selectedVoice.title.split("\u00b7")[0].trim()}&apos;s default posture. You can switch anytime in the composer.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "36px" }}>
                {selectedVoice.intents.map((intent, i) => {
                  const isSelected = selectedVariant === intent
                  const tagline = VARIANT_TAGLINES[selectedVoice.id]?.[intent] ?? ""
                  return (
                    <button
                      key={intent}
                      className={`ob-card${isSelected ? " selected" : ""}`}
                      onClick={() => {
                        setSelectedVariant(intent)
                        // Auto-advance after brief delay to show selection
                        setTimeout(() => {
                          if (!isSubmitting && selectedVoice) {
                            handleSubmitDirect(selectedVoice, intent)
                          }
                        }, 400)
                      }}
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
                        animation: `ob-fade-up 0.4s ease ${0.06 * i}s backwards`,
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
                      <div style={{
                        opacity: isSelected ? 1 : 0,
                        transform: isSelected ? "scale(1)" : "scale(0.5)",
                        transition: "opacity 0.2s ease, transform 0.2s ease",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7.5" stroke={GOLD} />
                          <path d="M5 8l2 2 4-4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
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
                  marginBottom: "16px",
                }}
              >
                {isSubmitting ? "Launching\u2026" : isRevisit ? "Update and return \u2192" : "Enter the composer \u2192"}
              </button>

              <button
                className="ob-back"
                onClick={() => { stopAudio(); goToStep(4) }}
                style={{ background: "none", border: "none", color: MUTED, fontSize: "13px", cursor: "pointer", padding: 0 }}
              >
                &larr; Back
              </button>
            </div>
          </StepContent>
        )}

        </div>{/* end vertically centered content area */}

        {/* Isotype footer anchor */}
        <div style={{
          position: "fixed",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
        }}>
          <Isotype height={32} color="#ffffff" opacity={1} />
        </div>
      </div>
    </>
  )
}
