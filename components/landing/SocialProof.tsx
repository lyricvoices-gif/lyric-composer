"use client"

import { useEffect, useRef } from "react"
import ScrollReveal from "./ScrollReveal"
import { CREAM, TEXT1, GOLD, display, italic, label } from "./tokens"
import { track } from "./track"

const LINKEDIN_HREF = "https://www.linkedin.com/in/mikeybucks"

export default function SocialProof() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || viewedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          track("built_with_section_viewed")
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function onLinkedInClick() {
    track("linkedin_clicked")
  }

  return (
    <div ref={sectionRef} style={{ background: CREAM, padding: "120px 24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Built with</p>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 0 32px",
              lineHeight: 1.05,
              maxWidth: "22ch",
            }}
          >
            Created by founders who&apos;ve built AI products for the world&apos;s top brands.
            <br />
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>
              Powered by professional voice artists.
            </span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <p
            style={{
              fontSize: "18px",
              color: "rgba(43,42,37,0.8)",
              lineHeight: 1.6,
              maxWidth: "65ch",
              margin: 0,
            }}
          >
            Lyric was founded by Michael Lang, an AI leader at Amazon, and co-founders with backgrounds in leading AI, tech, and creative industries.
            <br />
            We launched Lyric to set a new standard for ethical voice technology.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={310}>
          <a
            href={LINKEDIN_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLinkedInClick}
            aria-label="Meet the founders on LinkedIn"
            className="built-with-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "24px",
              ...display,
              fontStyle: "italic",
              fontSize: "16px",
              color: TEXT1,
              textDecoration: "none",
              letterSpacing: "0.005em",
              position: "relative",
            }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ flexShrink: 0 }}
            >
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
            <span className="built-with-link-text">Meet the founders</span>
            <span aria-hidden="true" style={{ color: GOLD, marginLeft: "2px" }}>
              →
            </span>
          </a>
        </ScrollReveal>
      </div>
    </div>
  )
}
