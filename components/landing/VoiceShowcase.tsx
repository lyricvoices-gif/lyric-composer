"use client"

import { getAllVoices } from "@/lib/voiceData"
import ScrollReveal from "./ScrollReveal"
import AudioPlayButton from "./AudioPlayButton"
import { CREAM, TEXT1, TEXT2, TEXT3, GOLD, display, italic, label } from "./tokens"

export default function VoiceShowcase() {
  const voices = getAllVoices()

  return (
    <div id="voices" style={{ background: CREAM, padding: "clamp(72px, 10vh, 112px) 24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Edition 01 · The Five</p>
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
              maxWidth: "16ch",
            }}
          >
            Five voices, each with a{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>point of view.</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <p
            style={{
              fontSize: "16px",
              color: TEXT2,
              lineHeight: 1.6,
              maxWidth: "520px",
              margin: "0 0 56px",
            }}
          >
            Each voice was performed by a real artist, captured across the emotional range it was built for. Press play. Hear what direction sounds like.
          </p>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {voices.map((v, i) => {
            const [name, archetype] = v.title.split(" · ")
            return (
              <ScrollReveal key={v.id} delay={i * 80}>
                <article
                  style={{
                    background: "#ffffff",
                    border: `1px solid rgba(28,25,23,0.06)`,
                    borderRadius: "20px",
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Gradient block as visual signature for each voice */}
                  <div
                    aria-hidden="true"
                    style={{
                      height: "180px",
                      background: `linear-gradient(135deg, ${v.gradientFrom} 0%, ${v.gradientTo} 100%)`,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "16px",
                        left: "20px",
                        fontSize: "10px",
                        fontWeight: 600,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "rgba(28,25,23,0.55)",
                      }}
                    >
                      {v.edition}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "20px",
                        ...italic,
                        fontSize: "32px",
                        color: "rgba(28,25,23,0.85)",
                        lineHeight: 1,
                      }}
                    >
                      {name.toLowerCase()}
                    </span>
                  </div>

                  <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                    <div>
                      <h3
                        style={{
                          ...display,
                          fontSize: "22px",
                          fontWeight: 500,
                          color: TEXT1,
                          margin: "0 0 4px",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {name}
                      </h3>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: TEXT3,
                          margin: 0,
                        }}
                      >
                        {archetype}
                      </p>
                    </div>

                    <p
                      style={{
                        fontSize: "13px",
                        color: TEXT2,
                        lineHeight: 1.55,
                        margin: 0,
                        flex: 1,
                      }}
                    >
                      {v.blurb}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {v.intents.map((intent) => (
                        <span
                          key={intent}
                          style={{
                            fontSize: "11px",
                            color: TEXT2,
                            padding: "3px 9px",
                            borderRadius: "100px",
                            background: "rgba(28,25,23,0.05)",
                            border: "1px solid rgba(28,25,23,0.06)",
                          }}
                        >
                          {intent}
                        </span>
                      ))}
                    </div>

                    <div style={{ marginTop: "4px" }}>
                      <AudioPlayButton sampleUrl={v.sampleUrl} voiceId={v.id} voiceName={v.title} />
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </div>
  )
}
