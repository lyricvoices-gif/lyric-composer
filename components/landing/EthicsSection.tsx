"use client"

import { useEffect, useRef } from "react"
import ScrollReveal from "./ScrollReveal"
import { DARK, LIGHT, GOLD, display, italic, label, SIGNUP_HREF } from "./tokens"
import { track } from "./track"

// Three pillars, ordered as a sales sequence:
//   01 — we protect the artists      (proves the moral position)
//   02 — we protect your legal exposure (removes a real-world risk)
//   03 — we protect your work        (closes on data + IP)
const PILLARS = [
  {
    n: "01",
    eyebrow: "Real artists, real contracts",
    title: "Voices built with the people who own them.",
    body:
      "Every voice in Edition 01 was performed by a working voice artist who signed, recorded, and trained the model with us. They are credited, paid up front, and earn ongoing revenue every time their voice is used. No scraping. No surprises. No legal exposure.",
  },
  {
    n: "02",
    eyebrow: "Clearance built in",
    title: "Commercial rights, included.",
    body:
      "Creator and Studio plans include full commercial rights to the audio you generate. Brand campaigns, podcasts, broadcast spots, client deliverables. Direct your script, generate, ship.",
  },
  {
    n: "03",
    eyebrow: "Your work is yours",
    title: "Scripts and audio stay with you.",
    body:
      "Your scripts and generated audio are never used to train third-party AI models. Your work stays your work. Lyric is a tool for your craft, not a data extraction layer.",
  },
]

export default function EthicsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || viewedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          track("wedge_section_viewed")
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function onCtaClick() {
    track("wedge_cta_clicked")
    track("landing_signup_start", { source: "wedge" })
  }

  return (
    <div
      ref={sectionRef}
      style={{
        background: DARK,
        padding: "clamp(96px, 14vh, 144px) 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft gold radial accent — same vocabulary as the hero so the dark
          sections feel related across the page. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(201,169,110,0.08) 0%, rgba(201,169,110,0) 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "1120px", margin: "0 auto", position: "relative" }}>
        {/* ── Top zone: header ─────────────────────────────────────────── */}
        <ScrollReveal>
          <p style={{ ...label, color: "rgba(245,243,239,0.6)", marginBottom: "20px" }}>
            Why Lyric is different
          </p>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.8vw, 60px)",
              fontWeight: 500,
              color: LIGHT,
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
              margin: "0 0 32px",
              maxWidth: "20ch",
            }}
          >
            The only AI voice platform you can use{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>without flinching.</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <p
            style={{
              fontSize: "17px",
              color: "rgba(245,243,239,0.8)",
              lineHeight: 1.6,
              maxWidth: "60ch",
              margin: 0,
            }}
          >
            Your work clears legal. Your clients say yes. Your audience never feels the uncanny valley.
          </p>
        </ScrollReveal>

        {/* ── Thin gold rule between top zone and columns ───────────────── */}
        <ScrollReveal delay={240}>
          <hr
            aria-hidden="true"
            style={{
              border: "none",
              borderTop: `1px solid ${GOLD}`,
              opacity: 0.4,
              margin: "80px 0 0",
            }}
          />
        </ScrollReveal>

        {/* ── Middle zone: three pillars ────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "clamp(48px, 5vw, 64px)",
            marginTop: "64px",
          }}
        >
          {PILLARS.map((p, i) => (
            <ScrollReveal key={p.n} delay={320 + i * 100}>
              <div>
                <span
                  style={{
                    ...display,
                    fontStyle: "italic",
                    fontSize: "16px",
                    color: GOLD,
                    opacity: 0.8,
                    display: "block",
                    marginBottom: "24px",
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                  }}
                >
                  {p.n}
                </span>

                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(245,243,239,0.6)",
                    margin: "0 0 16px",
                    lineHeight: 1.4,
                  }}
                >
                  {p.eyebrow}
                </p>

                <h3
                  style={{
                    ...display,
                    fontSize: "23px",
                    fontWeight: 400,
                    color: LIGHT,
                    margin: "0 0 20px",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  {p.title}
                </h3>

                <p
                  style={{
                    fontSize: "16px",
                    color: "rgba(245,243,239,0.78)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {p.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* ── Bottom zone: CTA ──────────────────────────────────────────── */}
        <ScrollReveal delay={640}>
          <div
            style={{
              marginTop: "clamp(72px, 10vh, 96px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <a
              href={SIGNUP_HREF}
              onClick={onCtaClick}
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
            <p
              style={{
                ...display,
                fontSize: "14px",
                color: "rgba(245,243,239,0.6)",
                margin: 0,
                letterSpacing: "0.005em",
                textAlign: "center",
                maxWidth: "70ch",
                lineHeight: 1.5,
              }}
            >
              7-day free trial. Credit card required. Cancel anytime.
              <br />
              Full commercial rights on Creator and Studio plans.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  )
}
