"use client"

import Image from "next/image"
import ScrollReveal from "./ScrollReveal"
import { CREAM, TEXT1, TEXT2, TEXT3, GOLD, display, italic, label } from "./tokens"

const founders = [
  { src: "/landing/images/founder-1.webp", alt: "Founder portrait" },
  { src: "/landing/images/founder-2.webp", alt: "Founder portrait" },
  { src: "/landing/images/founder-3.webp", alt: "Founder portrait" },
  { src: "/landing/images/founder-4.webp", alt: "Founder portrait" },
]

const quotes = [
  {
    body: "Direction inside the script is the missing piece in every other AI voice tool. Lyric is the first one that feels like a creative partner rather than a button.",
    name: "Early Studio user",
    role: "Brand director",
  },
  {
    body: "I gave it a thirty-second spot script with three emotion tags and got back a take I would have paid a session voice for. Then I tried two more variants in a minute.",
    name: "Early Creator user",
    role: "Independent producer",
  },
]

export default function SocialProof() {
  return (
    <div style={{ background: CREAM, padding: "clamp(72px, 10vh, 112px) 24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Built with</p>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 0 56px",
              lineHeight: 1.05,
              maxWidth: "22ch",
            }}
          >
            Made by people who&apos;ve shipped AI products at the brands you&apos;ve heard of.{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>Voices by people you&apos;ve heard.</span>
          </h2>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "32px",
            alignItems: "start",
          }}
        >
          <ScrollReveal delay={120}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "20px 24px",
                background: "#ffffff",
                borderRadius: "100px",
                border: "1px solid rgba(28,25,23,0.06)",
                width: "fit-content",
              }}
            >
              <div style={{ display: "flex" }}>
                {founders.map((f, i) => (
                  <div
                    key={f.src}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #ffffff",
                      marginLeft: i === 0 ? 0 : "-10px",
                      background: "#d4c9bc",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={f.src}
                      alt={f.alt}
                      width={36}
                      height={36}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "13px", color: TEXT2, margin: 0, letterSpacing: "0.01em" }}>
                Shaped by designers behind AI products at top brands.
              </p>
            </div>
          </ScrollReveal>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
            marginTop: "56px",
          }}
        >
          {quotes.map((q, i) => (
            <ScrollReveal key={q.body} delay={180 + i * 80}>
              <figure
                style={{
                  margin: 0,
                  padding: "32px",
                  background: "#ffffff",
                  border: "1px solid rgba(28,25,23,0.06)",
                  borderRadius: "20px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <span
                  style={{
                    ...display,
                    fontStyle: "italic",
                    fontSize: "44px",
                    color: GOLD,
                    lineHeight: 0.5,
                    height: "20px",
                  }}
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <blockquote
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: TEXT1,
                    lineHeight: 1.55,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {q.body}
                </blockquote>
                <figcaption style={{ fontSize: "12px", color: TEXT3, letterSpacing: "0.01em" }}>
                  <strong style={{ color: TEXT2, fontWeight: 600 }}>{q.name}</strong> · {q.role}
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  )
}
