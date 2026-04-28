"use client"

import Isotype from "./Isotype"
import { DARK, LIGHT, GOLD } from "./tokens"

const SOCIAL_LINKS = [
  { name: "Substack", href: "https://thelyricbriefing.substack.com" },
  { name: "Instagram", href: "https://instagram.com/lyricvoices" },
  { name: "X", href: "https://x.com/lyricvoices" },
  { name: "Threads", href: "https://threads.net/@lyricvoices" },
  { name: "Spotify", href: "https://open.spotify.com" },
  { name: "YouTube", href: "https://youtube.com/@lyricvoices" },
]

const LEGAL_LINKS = [
  { name: "Terms of Use", href: "https://www.lyricvoices.ai/terms" },
  { name: "Privacy Policy", href: "https://www.lyricvoices.ai/privacy" },
  { name: "lyricvoices.ai", href: "https://www.lyricvoices.ai" },
]

const linkStyle: React.CSSProperties = {
  color: "rgba(245,243,239,0.6)",
  fontSize: "13px",
  textDecoration: "none",
  letterSpacing: "0.01em",
}

export default function LandingFooter() {
  return (
    <footer style={{ background: DARK, padding: "64px 24px 40px", borderTop: "1px solid rgba(245,243,239,0.06)" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "40px",
            marginBottom: "48px",
          }}
        >
          {/* Brand */}
          <div>
            <a href="/" aria-label="Lyric" style={{ color: LIGHT, display: "inline-block", marginBottom: "16px" }}>
              <Isotype size={32} color={LIGHT} />
            </a>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(245,243,239,0.5)",
                lineHeight: 1.55,
                margin: "0 0 16px",
                maxWidth: "260px",
              }}
            >
              Voice artists build the voices.{" "}
              <span style={{ fontFamily: "var(--font-instrument)", fontStyle: "italic", color: GOLD }}>
                You compose with them.
              </span>
            </p>
            <a href="mailto:hi@lyricvoices.ai" style={linkStyle}>
              hi@lyricvoices.ai
            </a>
          </div>

          {/* Product */}
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(245,243,239,0.42)",
                margin: "0 0 16px",
              }}
            >
              Product
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              <li>
                <a href="#voices" style={linkStyle}>The voices</a>
              </li>
              <li>
                <a href="#pricing" style={linkStyle}>Pricing</a>
              </li>
              <li>
                <a href="/sign-up" style={linkStyle}>Start free trial</a>
              </li>
              <li>
                <a href="/sign-in" style={linkStyle}>Sign in</a>
              </li>
            </ul>
          </div>

          {/* Follow */}
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(245,243,239,0.42)",
                margin: "0 0 16px",
              }}
            >
              Follow
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {SOCIAL_LINKS.map((link) => (
                <li key={link.name}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(245,243,239,0.42)",
                margin: "0 0 16px",
              }}
            >
              Legal
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {LEGAL_LINKS.map((link) => (
                <li key={link.name}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            paddingTop: "24px",
            borderTop: "1px solid rgba(245,243,239,0.08)",
            fontSize: "12px",
            color: "rgba(245,243,239,0.4)",
          }}
        >
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} Lyric Voices. All rights reserved.</p>
          <p style={{ margin: 0, fontFamily: "var(--font-instrument)", fontStyle: "italic" }}>
            Composed, not cloned.
          </p>
        </div>
      </div>
    </footer>
  )
}
