"use client"

import ScrollReveal from "./ScrollReveal"
import { DARK, LIGHT, GOLD, display, italic, label } from "./tokens"

const pillars = [
  {
    title: "Real artists, real partnerships",
    body: "Every voice on Lyric was performed by a working voice actor we partnered with directly. They are credited, compensated, and continuously paid as the voices they built earn revenue.",
  },
  {
    title: "Composed, not cloned",
    body: "We do not clone voices from samples scraped off the internet. We build voices in collaboration with the people who own them, using captured emotional range and consent at every step.",
  },
  {
    title: "Built for trust",
    body: "Each voice ships with a guardrail describing the off-label uses we won't permit. The voice is a character with a point of view, not a generic instrument.",
  },
]

export default function EthicsSection() {
  return (
    <div
      style={{
        background: DARK,
        padding: "clamp(96px, 14vh, 144px) 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gold radial accent */}
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
        <ScrollReveal>
          <p style={{ ...label, color: "rgba(245,243,239,0.55)", marginBottom: "20px" }}>
            The wedge
          </p>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.8vw, 60px)",
              fontWeight: 500,
              color: LIGHT,
              letterSpacing: "-0.02em",
              lineHeight: 1.0,
              margin: "0 0 32px",
              maxWidth: "20ch",
            }}
          >
            Composed,{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>not cloned.</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <p
            style={{
              fontSize: "17px",
              color: "rgba(245,243,239,0.7)",
              lineHeight: 1.6,
              maxWidth: "620px",
              margin: "0 0 72px",
            }}
          >
            The voice industry is full of stolen samples and synthetic copies. Lyric was built the other way around. Voice artists build the voices. You compose with them.
          </p>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "48px",
            paddingTop: "48px",
            borderTop: "1px solid rgba(245,243,239,0.1)",
          }}
        >
          {pillars.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 100}>
              <div>
                <span
                  style={{
                    ...display,
                    fontSize: "26px",
                    fontWeight: 400,
                    color: GOLD,
                    fontStyle: "italic",
                    display: "block",
                    marginBottom: "16px",
                    lineHeight: 1,
                  }}
                >
                  0{i + 1}
                </span>
                <h3
                  style={{
                    ...display,
                    fontSize: "20px",
                    fontWeight: 500,
                    color: LIGHT,
                    margin: "0 0 12px",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.25,
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ fontSize: "14px", color: "rgba(245,243,239,0.6)", lineHeight: 1.6, margin: 0 }}>
                  {p.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  )
}
