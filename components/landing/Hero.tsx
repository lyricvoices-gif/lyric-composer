"use client"

import { useEffect, useRef } from "react"
import Wordmark from "@/components/Wordmark"
import { DARK, LIGHT, GOLD, italic, display, SIGNUP_HREF, SIGNIN_HREF } from "./tokens"
import { track } from "./track"

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pause the hero video when the tab is hidden — saves CPU on mobile,
  // and prevents Safari autoplay re-triggers when the user comes back.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    function onVisibility() {
      if (!v) return
      if (document.hidden) v.pause()
      else v.play().catch(() => {})
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  function onPrimary() {
    track("landing_cta_click", { cta: "hero_primary", target: "signup" })
    track("landing_signup_start", { source: "hero" })
  }

  function onSecondary() {
    track("landing_cta_click", { cta: "hero_secondary", target: "signin" })
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
      {/* Looping sizzle reel — muted, autoplay, loop, playsinline */}
      <video
        ref={videoRef}
        src="/landing/videos/sizzle.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.28,
          filter: "blur(6px) saturate(0.85)",
          transform: "scale(1.08)", // hide blur edges
          zIndex: 0,
        }}
      />

      {/* Dark + gold gradient wash over the video for legibility */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(43,42,37,0.78) 0%, rgba(43,42,37,0.82) 40%, rgba(43,42,37,0.95) 100%)",
        }}
      />

      {/* Top bar: wordmark + sign-in (no nav clutter) */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          padding: "24px 32px",
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
          onClick={onSecondary}
          style={{
            color: "rgba(245,243,239,0.78)",
            fontSize: "13px",
            letterSpacing: "0.01em",
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: "100px",
            border: "1px solid rgba(245,243,239,0.14)",
            background: "rgba(245,243,239,0.04)",
          }}
        >
          Sign in
        </a>
      </header>

      {/* Main hero content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "clamp(48px, 8vh, 96px) 32px clamp(64px, 12vh, 120px)",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
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

        <h1
          style={{
            ...display,
            fontSize: "clamp(40px, 7vw, 88px)",
            fontWeight: 500,
            color: LIGHT,
            margin: 0,
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            maxWidth: "18ch",
          }}
        >
          Voice artists build the voices.{" "}
          <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>You compose with them.</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 1.6vw, 19px)",
            lineHeight: 1.55,
            color: "rgba(245,243,239,0.7)",
            maxWidth: "520px",
            margin: 0,
          }}
        >
          Direct five voice artists with intent, emotion, and pacing. Generate broadcast-ready audio in seconds. Composed, not cloned.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginTop: "8px" }}>
          <a
            href={SIGNUP_HREF}
            onClick={onPrimary}
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
          <a
            href="#voices"
            onClick={() => track("landing_cta_click", { cta: "hero_listen", target: "voices" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 24px",
              borderRadius: "100px",
              fontSize: "15px",
              fontWeight: 400,
              background: "rgba(245,243,239,0.04)",
              color: "rgba(245,243,239,0.85)",
              border: "1px solid rgba(245,243,239,0.18)",
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            Hear the voices
          </a>
        </div>

        <p
          style={{
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "rgba(245,243,239,0.42)",
            margin: 0,
            marginTop: "4px",
          }}
        >
          7-day free trial. Credit card required. Cancel anytime.
        </p>
      </div>

      {/* Subtle scroll cue */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "24px",
          transform: "translateX(-50%)",
          color: "rgba(245,243,239,0.4)",
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          zIndex: 2,
        }}
      >
        Scroll
      </div>
    </section>
  )
}
