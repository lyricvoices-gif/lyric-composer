"use client"

import { useEffect, useRef, useState } from "react"
import ScrollReveal from "./ScrollReveal"
import { LIGHT, DARK, TEXT1, TEXT2, GOLD, display, italic, label, SIGNUP_HREF } from "./tokens"
import { track } from "./track"

interface VideoSlide {
  src: string
  caption: string
  alt: string
}

// Order matches the workflow: cast → compose → direct → hear.
// Captions are italic film-subtitle / museum-placard style — one sentence,
// no terminal punctuation. The video's own motion has to do the explaining.
const SLIDES: VideoSlide[] = [
  {
    src: "/landing/videos/voice-selection.mp4",
    caption: "Five real voice artists, ready when you are",
    alt: "Selecting a voice in the Lyric composer",
  },
  {
    src: "/landing/videos/script.mp4",
    caption: "Your script becomes the canvas",
    alt: "Writing a script in the Lyric composer",
  },
  {
    src: "/landing/videos/emotional-tag.mp4",
    caption: "Direction lives inside the words",
    alt: "Tagging a phrase with an emotion mark",
  },
  {
    src: "/landing/videos/generation.mp4",
    caption: "Broadcast-ready audio in seconds",
    alt: "Generating audio from a directed script",
  },
]

interface LazyVideoProps {
  src: string
  alt: string
  position: number
}

function LazyVideo({ src, alt, position }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)
  const playFiredRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!loaded) {
            el.src = src
            el.load()
            setLoaded(true)
          }
          el.play().catch(() => {})
          if (!playFiredRef.current) {
            playFiredRef.current = true
            track("video_played", { video_position: position })
          }
        } else {
          el.pause()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [src, loaded, position])

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      onEnded={() => track("video_completed", { video_position: position })}
      style={{
        width: "100%",
        display: "block",
        background: "#1a1a18",
        aspectRatio: "16 / 10",
        objectFit: "cover",
        borderRadius: "4px", // a hair of softness so edges don't feel pasted onto the cream
      }}
    />
  )
}

export default function ComposerDemo() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)

  // what_youll_make_viewed: explicit named event for the analytics dashboard.
  // SectionTracker still fires the generic landing_section_visible above this
  // component; both can co-exist.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || viewedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          track("what_youll_make_viewed")
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function onCtaClick() {
    track("what_youll_make_cta_clicked")
    track("landing_signup_start", { source: "what_youll_make" })
  }

  return (
    <div
      ref={sectionRef}
      style={{ background: LIGHT, padding: "clamp(72px, 10vh, 112px) 24px" }}
    >
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px", textAlign: "center" }}>What you&apos;ll make</p>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 auto 20px",
              lineHeight: 1.0,
              maxWidth: "18ch",
              textAlign: "center",
            }}
          >
            Direction is part of the format.{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>Not a setting.</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <p
            style={{
              fontSize: "16px",
              color: TEXT2,
              lineHeight: 1.6,
              maxWidth: "560px",
              // Bottom margin matches the section's outer top padding so the
              // header content block has equal breathing room above the
              // eyebrow and below the subhead.
              margin: "0 auto clamp(72px, 10vh, 112px)",
              textAlign: "center",
            }}
          >
            Most AI voice tools give you a slider. Lyric gives you a script you can direct, sentence by sentence. Watch what that looks like.
          </p>
        </ScrollReveal>

        {/* 2x2 grid. minmax(min(420px, 100%), 1fr) keeps two columns above
            ~840px and collapses cleanly to one column below — without the
            min() guard, narrow viewports get a 420px column that overflows
            the screen edge instead of shrinking. No card chrome; the video
            carries the moment with a single italic caption beneath. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
            gap: "clamp(32px, 4vw, 48px)",
            alignItems: "start",
          }}
        >
          {SLIDES.map((slide, i) => (
            <ScrollReveal key={slide.src} delay={i * 80}>
              <figure
                style={{
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }}
              >
                <LazyVideo src={slide.src} alt={slide.alt} position={i + 1} />
                <figcaption
                  style={{
                    ...display,
                    fontStyle: "italic",
                    fontSize: "clamp(16px, 1.5vw, 19px)",
                    color: "rgba(43,42,37,0.8)",
                    textAlign: "center",
                    lineHeight: 1.4,
                    letterSpacing: "0.005em",
                    margin: 0,
                  }}
                >
                  {slide.caption}
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>

        {/* Closing CTA. Sits at peak intent — visitor has just watched the
            workflow play out, the next click should be free trial. */}
        <ScrollReveal delay={400}>
          <div
            style={{
              marginTop: "clamp(72px, 10vh, 96px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <a
              href={SIGNUP_HREF}
              onClick={onCtaClick}
              className="btn-section-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                borderRadius: "100px",
                fontSize: "15px",
                fontWeight: 500,
                background: DARK,
                color: LIGHT,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              Start your free trial
              <span aria-hidden="true" style={{ fontSize: "13px" }}>→</span>
            </a>
            <p
              style={{
                ...display,
                fontSize: "14px",
                color: "rgba(43,42,37,0.6)",
                margin: 0,
                letterSpacing: "0.005em",
                textAlign: "center",
              }}
            >
              7-day free trial. Credit card required. Cancel anytime.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  )
}
