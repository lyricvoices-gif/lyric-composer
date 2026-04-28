"use client"

import ScrollReveal from "./ScrollReveal"
import {
  LIGHT,
  DARK,
  TEXT1,
  TEXT2,
  TEXT3,
  GOLD,
  BORDER,
  display,
  italic,
  label,
  SIGNUP_HREF,
} from "./tokens"
import { track } from "./track"

interface Plan {
  id: string
  name: string
  price: string
  period: string
  tagline: string
  highlight?: boolean
  badge?: string
  cta: string
  href: string
  features: string[]
}

// Numbers reflect the actual lib/planConfig.ts limits so trial expectations match reality.
const plans: Plan[] = [
  {
    id: "creator",
    name: "Creator",
    price: "$29",
    period: "/mo",
    tagline: "For creators getting started.",
    cta: "Start free trial",
    href: SIGNUP_HREF,
    features: [
      "All 5 Edition 01 voices",
      "25 generations per day",
      "Scripts up to 500 characters",
      "Inline emotion marks",
      "MP3 download",
      "Commercial use rights",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$99",
    period: "/mo",
    tagline: "For working teams and brands.",
    highlight: true,
    badge: "Most popular",
    cta: "Start free trial",
    href: SIGNUP_HREF,
    features: [
      "Everything in Creator",
      "100 generations per day",
      "Scripts up to 2,000 characters",
      "Premium quality rendering",
      "Priority queue",
      "Early access to new Editions",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For agencies and product teams.",
    cta: "Contact us",
    href: "mailto:hi@lyricvoices.ai?subject=Enterprise%20inquiry",
    features: [
      "Everything in Studio",
      "Unlimited generations",
      "Scripts up to 10,000 characters",
      "Custom voice creation",
      "API access & SSO",
      "Dedicated support",
    ],
  },
]

export default function PricingSection() {
  return (
    <div id="pricing" style={{ background: LIGHT, padding: "clamp(72px, 10vh, 112px) 24px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Pricing</p>
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
            Voices that perform.{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>Pricing that works.</span>
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
            Every plan starts with a 7-day free trial. Pick what fits today. Change it later.
          </p>
        </ScrollReveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            alignItems: "stretch",
          }}
        >
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.id} delay={i * 80}>
              <div
                style={{
                  background: plan.highlight ? DARK : "#ffffff",
                  border: plan.highlight ? "none" : `1px solid ${BORDER}`,
                  borderRadius: "20px",
                  padding: "32px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  height: "100%",
                }}
              >
                {plan.badge && (
                  <span
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: DARK,
                      background: GOLD,
                      padding: "4px 10px",
                      borderRadius: "100px",
                    }}
                  >
                    {plan.badge}
                  </span>
                )}

                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: TEXT3,
                    margin: "0 0 20px",
                  }}
                >
                  {plan.name}
                </p>

                <div style={{ marginBottom: "8px" }}>
                  <span
                    style={{
                      ...display,
                      fontSize: "48px",
                      fontWeight: 500,
                      letterSpacing: "-0.03em",
                      color: plan.highlight ? LIGHT : TEXT1,
                      lineHeight: 1,
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span style={{ fontSize: "14px", color: TEXT3, marginLeft: "4px" }}>{plan.period}</span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: "13px",
                    color: plan.highlight ? "rgba(245,243,239,0.55)" : TEXT2,
                    lineHeight: 1.5,
                    margin: "0 0 28px",
                  }}
                >
                  {plan.tagline}
                </p>

                <a
                  href={plan.href}
                  onClick={() => {
                    track("landing_cta_click", { cta: `pricing_${plan.id}`, target: plan.id === "enterprise" ? "contact" : "signup" })
                    if (plan.id !== "enterprise") track("landing_signup_start", { source: "pricing", plan: plan.id })
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "13px 20px",
                    borderRadius: "100px",
                    fontSize: "13px",
                    fontWeight: 500,
                    background: plan.highlight ? LIGHT : DARK,
                    color: plan.highlight ? DARK : LIGHT,
                    marginBottom: "24px",
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                  }}
                >
                  {plan.cta}
                </a>

                <div
                  style={{
                    borderTop: plan.highlight
                      ? "1px solid rgba(245,243,239,0.12)"
                      : `1px solid ${BORDER}`,
                    paddingTop: "24px",
                    flex: 1,
                  }}
                >
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "6px 0",
                          fontSize: "13px",
                          color: plan.highlight ? "rgba(245,243,239,0.7)" : TEXT2,
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: GOLD, flexShrink: 0, fontSize: "12px", marginTop: "1px" }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={300}>
          <p
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: TEXT3,
              marginTop: "32px",
              letterSpacing: "0.01em",
            }}
          >
            Credit card required to start the trial. Cancel anytime before day 7 and you won&apos;t be charged.
          </p>
        </ScrollReveal>
      </div>
    </div>
  )
}
