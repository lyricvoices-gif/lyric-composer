"use client"

import ScrollReveal from "./ScrollReveal"
import { DARK, LIGHT, GOLD, display, italic, SIGNUP_HREF, SIGNIN_HREF } from "./tokens"
import { track } from "./track"

export default function FinalCta() {
  return (
    <div
      style={{
        background: DARK,
        padding: "clamp(96px, 14vh, 144px) 24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 30%, rgba(201,169,110,0.10) 0%, rgba(43,42,37,0) 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: "780px", margin: "0 auto" }}>
        <ScrollReveal>
          <h2
            style={{
              ...display,
              fontSize: "clamp(36px, 5.6vw, 72px)",
              fontWeight: 500,
              color: LIGHT,
              margin: "0 0 24px",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to direct{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>your first take?</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <p
            style={{
              fontSize: "17px",
              color: "rgba(245,243,239,0.6)",
              lineHeight: 1.55,
              maxWidth: "520px",
              margin: "0 auto 40px",
            }}
          >
            Seven days free. All five voices. Full direction. No pressure to keep going.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
            <a
              href={SIGNUP_HREF}
              onClick={() => {
                track("landing_cta_click", { cta: "final_primary", target: "signup" })
                track("landing_signup_start", { source: "final_cta" })
              }}
              style={{
                padding: "15px 30px",
                borderRadius: "100px",
                fontSize: "15px",
                fontWeight: 500,
                background: LIGHT,
                color: DARK,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              Start your free trial →
            </a>
            <a
              href={SIGNIN_HREF}
              onClick={() => track("landing_cta_click", { cta: "final_secondary", target: "signin" })}
              style={{
                padding: "15px 28px",
                borderRadius: "100px",
                fontSize: "15px",
                fontWeight: 400,
                background: "rgba(245,243,239,0.05)",
                color: "rgba(245,243,239,0.78)",
                border: "1px solid rgba(245,243,239,0.16)",
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              Sign in
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={220}>
          <p
            style={{
              fontSize: "12px",
              color: "rgba(245,243,239,0.4)",
              marginTop: "32px",
              letterSpacing: "0.02em",
            }}
          >
            Credit card required. Cancel before day 7 and you won&apos;t be charged.
          </p>
        </ScrollReveal>
      </div>
    </div>
  )
}
