"use client"

import Isotype from "./Isotype"
import { DARK, LIGHT, GOLD } from "./tokens"

// Social channels mirror the marketing site footer (lyricvoices.ai) so
// visitors who arrive on the funnel see the same brand surface.
const SOCIAL = [
  {
    label: "Substack",
    href: "https://thelyricbriefing.substack.com/",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/lyricvoices.ai/",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/thelyricvoices",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Threads",
    href: "https://www.threads.com/@lyricvoices.ai",
    icon: (
      <svg width="15" height="16" viewBox="0 0 192 192" fill="currentColor">
        <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.347-10.548h.23c8.249.053 14.474 2.452 18.502 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 6.997 4.676 16.01 6.96 25.393 6.46 12.383-.657 22.092-5.396 28.855-14.082 5.15-6.718 8.408-15.44 9.867-26.481 5.923 3.569 10.304 8.285 12.735 13.987 4.084 9.606 4.324 25.402-8.54 38.253-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.273-21.742C35.218 138.02 29.652 120.08 29.434 97.2c.218-22.88 5.784-40.82 16.537-53.311 11.213-14.258 28.464-21.573 51.273-21.742 22.981.17 40.526 7.52 52.171 21.847 5.762 7.088 10.09 15.96 12.929 26.419l16.1-4.301c-3.476-12.758-9.026-23.777-16.612-32.987C147.036 14.962 125.202 5.174 97.28 5h-.478C69.006 5.174 47.408 15.001 33.577 34.287 21.359 51.226 15.07 74.983 14.824 97.2v.4c.246 22.217 6.535 45.974 18.753 62.913C47.408 179.799 69.006 189.626 96.802 189.8h.478c24.806-.168 42.227-6.675 56.556-21.002 18.428-18.427 17.866-41.458 11.802-55.624-4.306-10.142-12.575-18.354-23.601-23.186zm-41.235 38.695c-10.427.583-21.263-4.098-21.806-14.082-.405-7.598 5.41-16.07 23.29-17.1 2.037-.117 4.035-.173 5.993-.173 6.151 0 11.92.6 17.18 1.731-1.956 24.347-14.568 29.012-24.657 29.624z" />
      </svg>
    ),
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/show/6iu0viCB2eTtNiE0SM1Pl6",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
  {
    label: "Pocket Casts",
    href: "https://pca.st/5u4gmbzu",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6C6.698 21.6 2.4 17.302 2.4 12S6.698 2.4 12 2.4 21.6 6.698 21.6 12 17.302 21.6 12 21.6zm0-17.4a7.2 7.2 0 1 0 0 14.4 7.2 7.2 0 0 0 0-14.4zm0 12a4.8 4.8 0 1 1 0-9.6 4.8 4.8 0 0 1 0 9.6z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@LyricVoices",
    icon: (
      <svg width="18" height="13" viewBox="0 0 24 17" fill="currentColor">
        <path d="M23.495 2.656a3.016 3.016 0 0 0-2.122-2.135C19.505 0 12 0 12 0S4.495 0 2.627.521A3.016 3.016 0 0 0 .505 2.656 31.38 31.38 0 0 0 0 8.5a31.38 31.38 0 0 0 .505 5.844 3.016 3.016 0 0 0 2.122 2.135C4.495 17 12 17 12 17s7.505 0 9.373-.521a3.016 3.016 0 0 0 2.122-2.135A31.38 31.38 0 0 0 24 8.5a31.38 31.38 0 0 0-.505-5.844zM9.546 12.068V4.932L15.818 8.5l-6.272 3.568z" />
      </svg>
    ),
  },
]

const LEGAL_LINKS = [
  { name: "Terms", href: "https://www.lyricvoices.ai/terms" },
  { name: "Privacy", href: "https://www.lyricvoices.ai/privacy" },
]

export default function LandingFooter() {
  return (
    <footer style={{ background: DARK }}>
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "16px 24px 32px",
        }}
      >
        {/* Centered brand block — sits between the closing CTA above and
            the bottom bar below. Mirrors the marketing-site footer block
            but center-aligned, since the funnel page deliberately drops
            the multi-column nav. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            paddingBottom: "40px",
            textAlign: "center",
          }}
        >
          <a href="/" aria-label="Lyric" style={{ color: LIGHT, display: "inline-block" }}>
            <Isotype size={36} color={LIGHT} />
          </a>

          <p
            style={{
              fontSize: "14px",
              color: "rgba(245,243,239,0.6)",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "52ch",
            }}
          >
            Lyric is the ethical AI voice platform. Every voice was built with a real artist who performed it.
          </p>

          <a
            href="mailto:hi@lyricvoices.ai"
            style={{
              fontSize: "13px",
              color: "rgba(245,243,239,0.55)",
              letterSpacing: "0.01em",
              textDecoration: "none",
            }}
          >
            hi@lyricvoices.ai
          </a>

          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-icon"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar — copyright (with inline legal links) on the left,
            tagline on the right. Tagline is bumped up a hair so it reads
            as a deliberate brand line rather than fine print. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "24px",
            borderTop: "1px solid rgba(245,243,239,0.08)",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "rgba(245,243,239,0.4)",
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            © {new Date().getFullYear()} Lyric Voices, Inc.
            {LEGAL_LINKS.map((l) => (
              <span key={l.name}>
                <span aria-hidden="true" style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-legal-link"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {l.name}
                </a>
              </span>
            ))}
          </p>
          <p
            style={{
              fontFamily: "var(--font-instrument)",
              fontStyle: "italic",
              fontSize: "15px",
              color: GOLD,
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            Composed, not cloned.
          </p>
        </div>
      </div>
    </footer>
  )
}
