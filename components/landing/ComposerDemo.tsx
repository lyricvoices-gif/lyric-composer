"use client"

import { useEffect, useRef, useState } from "react"
import ScrollReveal from "./ScrollReveal"
import { LIGHT, TEXT1, TEXT2, TEXT3, GOLD, display, italic, label } from "./tokens"
import { track } from "./track"

interface DemoStep {
  src: string
  eyebrow: string
  title: string
  body: string
}

const steps: DemoStep[] = [
  {
    src: "/landing/videos/voice-selection.mp4",
    eyebrow: "Step 01",
    title: "Choose a voice",
    body: "Pick from five voices, each performed by a real artist with their own emotional range.",
  },
  {
    src: "/landing/videos/script.mp4",
    eyebrow: "Step 02",
    title: "Write the script",
    body: "Type or paste your copy. The composer treats your script as a performance, not a transcript.",
  },
  {
    src: "/landing/videos/emotional-tag.mp4",
    eyebrow: "Step 03",
    title: "Direct with emotion marks",
    body: "Tag a phrase as confident, intimate, suspenseful. Direction is built into the format.",
  },
  {
    src: "/landing/videos/generation.mp4",
    eyebrow: "Step 04",
    title: "Generate, listen, refine",
    body: "Hear the take. Adjust direction. Render again. Download MP3 when it sounds right.",
  },
]

function LazyVideo({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [played, setPlayed] = useState(false)

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
          if (!played) {
            setPlayed(true)
            track("landing_video_play", { src })
          }
        } else {
          el.pause()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [src, loaded, played])

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      style={{
        width: "100%",
        display: "block",
        background: "#1a1a18",
        aspectRatio: "16 / 10",
        objectFit: "cover",
      }}
    />
  )
}

export default function ComposerDemo() {
  return (
    <div style={{ background: LIGHT, padding: "clamp(72px, 10vh, 112px) 24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>What you&apos;ll make</p>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 0 20px",
              lineHeight: 1.0,
              maxWidth: "18ch",
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
              margin: "0 0 64px",
            }}
          >
            Most AI voice tools give you a slider. Lyric gives you a script you can direct, sentence by sentence. This is what that looks like.
          </p>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {steps.map((s, i) => (
            <ScrollReveal key={s.src} delay={i * 80}>
              <figure
                style={{
                  margin: 0,
                  background: "#ffffff",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid rgba(28,25,23,0.06)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <LazyVideo src={s.src} alt={`${s.title} — composer demonstration`} />
                <figcaption style={{ padding: "20px 22px 22px" }}>
                  <p
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: TEXT3,
                      margin: "0 0 8px",
                    }}
                  >
                    {s.eyebrow}
                  </p>
                  <h3
                    style={{
                      ...display,
                      fontSize: "22px",
                      fontWeight: 500,
                      color: TEXT1,
                      margin: "0 0 8px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p style={{ fontSize: "13px", color: TEXT2, lineHeight: 1.55, margin: 0 }}>{s.body}</p>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  )
}
