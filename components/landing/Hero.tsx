"use client"

import { useEffect, useRef, useState } from "react"
import Wordmark from "@/components/Wordmark"
import { getVoice } from "@/lib/voiceData"
import { DARK, LIGHT, GOLD, italic, display, SIGNUP_HREF, SIGNIN_HREF } from "./tokens"
import { track } from "./track"
import ScrollReveal from "./ScrollReveal"

// Inline sample for the hero secondary CTA. Morgan is the flagship voice
// and the only voice that ships with a real R2-hosted sample today.
const HERO_SAMPLE = getVoice("morgan-anchor")

export default function Hero() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function onPrimary() {
    track("landing_cta_click", { cta: "hero_primary", target: "signup" })
    track("landing_signup_start", { source: "hero" })
  }

  function onSignIn() {
    track("landing_cta_click", { cta: "hero_signin", target: "signin" })
  }

  function onSamplePlay() {
    if (!audioRef.current) {
      const a = new Audio(HERO_SAMPLE.sampleUrl)
      a.preload = "auto"
      a.onended = () => setPlaying(false)
      a.onpause = () => setPlaying(false)
      a.onplay = () => setPlaying(true)
      audioRef.current = a
    }
    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      return
    }
    audioRef.current
      .play()
      .then(() => {
        track("landing_audio_play", { source: "hero", voiceId: HERO_SAMPLE.id })
        track("landing_cta_click", { cta: "hero_sample", target: "audio" })
      })
      .catch(() => setPlaying(false))
  }

  return (
    <section
      style={{
        position: "relative",
        background: DARK,
        minHeight: "100svh",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Soft gold radial accent for depth — no video; the editorial weight
          of the typography carries the hero on its own. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 25% 35%, rgba(201,169,110,0.08) 0%, rgba(43,42,37,0) 60%), radial-gradient(ellipse 40% 60% at 80% 70%, rgba(201,169,110,0.05) 0%, rgba(43,42,37,0) 60%)",
        }}
      />

      {/* Full-width hero container with section-level padding only — mirrors
          the marketing home hero (alignItems: flex-start, padding: 48px sides,
          no inner maxWidth wrapper). Wordmark + content share a left edge at
          48px from the viewport on every breakpoint. Per-element maxWidths
          below keep the headline + subhead from sprawling on ultrawide
          displays. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "24px 48px 64px",
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a href="/" aria-label="Lyric" style={{ color: LIGHT, display: "flex", alignItems: "center" }}>
            <Wordmark height={36} color={LIGHT} />
          </a>
          <a
            href={SIGNIN_HREF}
            onClick={onSignIn}
            className="btn-hero-signin"
            style={{
              color: "rgba(245,243,239,0.78)",
              fontSize: "13px",
              letterSpacing: "0.01em",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: "100px",
              border: "1px solid rgba(245,243,239,0.14)",
              background: "rgba(245,243,239,0.04)",
              whiteSpace: "nowrap",
            }}
          >
            Sign in / Sign up
          </a>
        </header>

        {/* Vertically-centered hero content. flex:1 + justifyContent:center
            anchors the headline near the optical middle of the viewport
            without depending on a magic top-padding number. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "32px",
            paddingTop: "clamp(48px, 6vh, 72px)",
            paddingBottom: "clamp(64px, 8vh, 96px)",
          }}
        >
          <ScrollReveal delay={0}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(245,243,239,0.55)",
                margin: 0,
              }}
            >
              Lyric Composer · Edition 01
            </p>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <h1
              style={{
                ...display,
                fontSize: "clamp(36px, 5.2vw, 64px)",
                fontWeight: 500,
                color: LIGHT,
                margin: 0,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                maxWidth: "1100px",
              }}
            >
              Studio-quality voiceover in seconds.
              <br />
              <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>Composed, not cloned.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={160}>
            <p
              style={{
                fontSize: "clamp(16px, 1.6vw, 19px)",
                lineHeight: 1.55,
                color: "rgba(245,243,239,0.72)",
                maxWidth: "620px",
                margin: 0,
              }}
            >
              For brands, agencies, and creators who need broadcast-ready audio without the booking, the budget, or the ethical baggage of voice cloning. Direct real voice artists with intent, emotion, and pacing.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={240}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginTop: "8px" }}>
            <a
              href={SIGNUP_HREF}
              onClick={onPrimary}
              className="btn-hero-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                borderRadius: "100px",
                fontSize: "15px",
                fontWeight: 500,
                background: LIGHT,
                color: DARK,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              Start your free trial
              <span aria-hidden="true" style={{ fontSize: "13px" }}>→</span>
            </a>
            <button
              type="button"
              onClick={onSamplePlay}
              aria-label={playing ? "Pause sample" : "Play a sample"}
              className="btn-hero-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 22px 14px 18px",
                borderRadius: "100px",
                fontSize: "15px",
                fontWeight: 400,
                background: playing ? "rgba(245,243,239,0.10)" : "rgba(245,243,239,0.04)",
                color: "rgba(245,243,239,0.9)",
                border: "1px solid rgba(245,243,239,0.18)",
                letterSpacing: "-0.01em",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "100px",
                  background: GOLD,
                  color: DARK,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {playing ? (
                  <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" aria-hidden="true">
                    <rect x="0" y="0" width="2.5" height="9" />
                    <rect x="5.5" y="0" width="2.5" height="9" />
                  </svg>
                ) : (
                  <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" aria-hidden="true">
                    <path d="M0.5 0.4v8.2l7-4.1z" />
                  </svg>
                )}
              </span>
              {playing ? "Pause sample" : "Play a sample"}
            </button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={320}>
            <p
              style={{
                fontSize: "12px",
                lineHeight: 1.6,
                letterSpacing: "0.01em",
                color: "rgba(245,243,239,0.45)",
                margin: 0,
                marginTop: "4px",
                maxWidth: "520px",
              }}
            >
              7-day free trial. Credit card required. Cancel anytime.
              <br />
              Full commercial rights on Creator and Studio plans.
            </p>
          </ScrollReveal>
        </div>
      </div>

      {/* Subtle scroll cue — mouse outline with an inner dot that ticks
          downward, fades, and loops. Implies the scroll-wheel gesture
          without leaning on a brand-foreign chevron. Compositor-only
          animation (opacity + transform); respects prefers-reduced-motion
          via globals.css. */}
      <div
        aria-hidden="true"
        className="hero-scroll-cue"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "24px",
          transform: "translateX(-50%)",
          color: "rgba(245,243,239,0.55)",
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <svg
          width="22"
          height="36"
          viewBox="0 0 22 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="1"
            y="1"
            width="20"
            height="34"
            rx="10"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle className="hero-scroll-cue-dot" cx="11" cy="9" r="1.75" fill="currentColor" />
        </svg>
        <span>Scroll</span>
      </div>
    </section>
  )
}
