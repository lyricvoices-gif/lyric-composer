"use client"

import { useEffect, useRef, useState } from "react"
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

type BillingPeriod = "monthly" | "annual"

interface Plan {
  id: "creator" | "studio" | "enterprise"
  name: string
  monthly: { display: string; period: string } // shown as $29/mo
  annual: { display: string; period: string }  // shown as $278/yr
  tagline: string
  highlight: boolean
  badge?: string
  cta: string
  href: string
  isContact: boolean
  features: string[]
}

// Plan data is the source of truth for what shows on this page. Mirrors the
// real lib/planConfig.ts limits so trial expectations match what the
// composer enforces. Annual prices are 12 × monthly × 0.8 (≈20% off),
// rounded to the nearest dollar.
const PLANS: Plan[] = [
  {
    id: "creator",
    name: "Creator",
    monthly: { display: "$29", period: "/mo" },
    annual:  { display: "$278", period: "/yr" },
    tagline: "For creators getting started.",
    highlight: false,
    cta: "Start with Creator",
    href: `${SIGNUP_HREF}?plan=creator`,
    isContact: false,
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
    monthly: { display: "$99", period: "/mo" },
    annual:  { display: "$950", period: "/yr" },
    tagline: "For working teams and brands.",
    highlight: true,
    badge: "Most popular",
    cta: "Try Studio free",
    href: `${SIGNUP_HREF}?plan=studio`,
    isContact: false,
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
    monthly: { display: "Custom", period: "" },
    annual:  { display: "Custom", period: "" },
    tagline: "For agencies and product teams.",
    highlight: false,
    cta: "Contact us",
    href: "mailto:hi@lyricvoices.ai?subject=Enterprise%20inquiry",
    isContact: true,
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
  const [period, setPeriod] = useState<BillingPeriod>("monthly")
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)
  // Track first hover per plan per page session so the analytics dashboard
  // doesn't see a flood of mouse-jiggle events on a single card.
  const hoverFiredRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const el = sectionRef.current
    if (!el || viewedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          track("pricing_section_viewed")
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function setBilling(next: BillingPeriod) {
    if (next === period) return
    track("annual_toggled", { to_period: next })
    setPeriod(next)
  }

  function onCardEnter(planId: Plan["id"]) {
    if (hoverFiredRef.current.has(planId)) return
    hoverFiredRef.current.add(planId)
    track("pricing_card_hovered", { plan: planId })
  }

  function onCtaClick(plan: Plan) {
    track("pricing_cta_clicked", { plan: plan.id, period })
    if (!plan.isContact) {
      track("landing_signup_start", { source: "pricing", plan: plan.id, period })
    }
  }

  return (
    <div
      ref={sectionRef}
      id="pricing"
      style={{ background: LIGHT, padding: "clamp(72px, 10vh, 112px) 24px" }}
    >
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        {/* Section header --------------------------------------------------- */}
        <ScrollReveal>
          <p style={{ ...label, marginBottom: "20px" }}>Pricing</p>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <h2
            style={{
              ...display,
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: TEXT1,
              margin: "0 0 20px",
              lineHeight: 1.0,
              maxWidth: "20ch",
            }}
          >
            Start composing today.{" "}
            <span style={{ ...italic, color: GOLD, fontWeight: 400 }}>Pay nothing for 7 days.</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <p
            style={{
              fontSize: "16px",
              color: TEXT2,
              lineHeight: 1.6,
              maxWidth: "60ch",
              margin: "0 0 40px",
            }}
          >
            Every plan starts with a 7-day free trial. Pick what fits today. Change it later.
          </p>
        </ScrollReveal>

        {/* Billing-period toggle ------------------------------------------- */}
        <ScrollReveal delay={220}>
          <div
            role="radiogroup"
            aria-label="Billing period"
            style={{
              display: "inline-flex",
              padding: "4px",
              background: "rgba(28,25,23,0.05)",
              border: "1px solid rgba(28,25,23,0.06)",
              borderRadius: "100px",
              marginBottom: "40px",
              gap: "2px",
            }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={period === "monthly"}
              onClick={() => setBilling("monthly")}
              className="pricing-period-btn"
              style={{
                padding: "8px 18px",
                borderRadius: "100px",
                fontSize: "13px",
                fontWeight: 500,
                background: period === "monthly" ? "#ffffff" : "transparent",
                color: period === "monthly" ? TEXT1 : TEXT3,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.01em",
                boxShadow: period === "monthly" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={period === "annual"}
              onClick={() => setBilling("annual")}
              className="pricing-period-btn"
              style={{
                padding: "8px 18px",
                borderRadius: "100px",
                fontSize: "13px",
                fontWeight: 500,
                background: period === "annual" ? "#ffffff" : "transparent",
                color: period === "annual" ? TEXT1 : TEXT3,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.01em",
                boxShadow: period === "annual" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
              }}
            >
              Annual
              <span
                aria-hidden="true"
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: GOLD,
                }}
              >
                Save 20%
              </span>
            </button>
          </div>
        </ScrollReveal>

        {/* Plan grid -------------------------------------------------------- */}
        <div
          className="pricing-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            alignItems: "center",
          }}
        >
          {PLANS.map((plan, i) => {
            const price = period === "annual" ? plan.annual : plan.monthly
            return (
              <ScrollReveal key={plan.id} delay={280 + i * 120}>
                <article
                  className={`pricing-card pricing-card-${plan.id}`}
                  data-highlight={plan.highlight}
                  onMouseEnter={() => onCardEnter(plan.id)}
                  style={{
                    background: plan.highlight ? DARK : "#ffffff",
                    border: plan.highlight ? "none" : `1px solid ${BORDER}`,
                    borderRadius: "20px",
                    padding: "32px",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    height: "100%",
                    boxShadow: plan.highlight
                      ? "0 24px 40px -16px rgba(0,0,0,0.25)"
                      : "0 6px 20px -16px rgba(0,0,0,0.18)",
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
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: DARK,
                        background: GOLD,
                        padding: "4px 10px",
                        borderRadius: "100px",
                      }}
                    >
                      <span className="visually-hidden" style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
                        Recommended:&nbsp;
                      </span>
                      {plan.badge}
                    </span>
                  )}

                  <p
                    style={{
                      ...display,
                      fontVariantCaps: "small-caps",
                      fontSize: "14px",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      color: plan.highlight ? "rgba(245,243,239,0.6)" : "rgba(28,25,23,0.55)",
                      margin: "0 0 24px",
                    }}
                  >
                    {plan.name}
                  </p>

                  <div style={{ marginBottom: "8px", display: "flex", alignItems: "baseline" }}>
                    {price.display !== "Custom" && (
                      <span
                        aria-hidden="true"
                        style={{
                          ...display,
                          fontSize: "32px",
                          fontWeight: 500,
                          color: plan.highlight ? LIGHT : TEXT1,
                          marginRight: "2px",
                          lineHeight: 1,
                        }}
                      >
                        $
                      </span>
                    )}
                    <span
                      style={{
                        ...display,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "64px",
                        fontWeight: 500,
                        letterSpacing: "-0.03em",
                        color: plan.highlight ? LIGHT : TEXT1,
                        lineHeight: 1,
                      }}
                    >
                      {price.display === "Custom" ? "Custom" : price.display.replace("$", "")}
                    </span>
                    {price.period && (
                      <span
                        style={{
                          fontSize: "20px",
                          color: plan.highlight ? "rgba(245,243,239,0.55)" : TEXT3,
                          marginLeft: "6px",
                          fontWeight: 400,
                          alignSelf: "flex-end",
                          marginBottom: "6px",
                        }}
                      >
                        {price.period}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: "16px",
                      color: plan.highlight ? "rgba(245,243,239,0.7)" : "rgba(28,25,23,0.65)",
                      lineHeight: 1.5,
                      margin: "0 0 32px",
                    }}
                  >
                    {plan.tagline}
                  </p>

                  <a
                    href={plan.href}
                    target={plan.isContact ? undefined : undefined}
                    rel={plan.isContact ? undefined : undefined}
                    onClick={() => onCtaClick(plan)}
                    aria-label={
                      plan.isContact
                        ? "Contact us about Enterprise"
                        : `Start ${plan.name} plan free trial`
                    }
                    className={plan.highlight ? "btn-pricing-light" : "btn-pricing-dark"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "13px 20px",
                      borderRadius: "100px",
                      fontSize: "14px",
                      fontWeight: 500,
                      background: plan.highlight ? LIGHT : DARK,
                      color: plan.highlight ? DARK : LIGHT,
                      letterSpacing: "-0.01em",
                      textDecoration: "none",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {plan.cta}
                  </a>

                  <hr
                    aria-hidden="true"
                    style={{
                      border: "none",
                      borderTop: plan.highlight
                        ? "1px solid rgba(245,243,239,0.12)"
                        : "1px solid rgba(28,25,23,0.08)",
                      margin: "24px -16px 20px",
                    }}
                  />

                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "6px 0",
                          fontSize: "15px",
                          color: plan.highlight ? "rgba(245,243,239,0.85)" : "rgba(28,25,23,0.85)",
                          lineHeight: 1.45,
                        }}
                      >
                        <span aria-hidden="true" style={{ color: GOLD, flexShrink: 0, fontSize: "12px", marginTop: "3px" }}>
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              </ScrollReveal>
            )
          })}
        </div>

        {/* Risk reversal ---------------------------------------------------- */}
        <ScrollReveal delay={680}>
          <p
            style={{
              ...display,
              textAlign: "center",
              fontSize: "14px",
              color: "rgba(28,25,23,0.6)",
              marginTop: "32px",
              letterSpacing: "0.005em",
              maxWidth: "70ch",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Credit card required to start the trial. Cancel anytime before day 7 and you won&apos;t be charged.
          </p>
        </ScrollReveal>
      </div>
    </div>
  )
}
