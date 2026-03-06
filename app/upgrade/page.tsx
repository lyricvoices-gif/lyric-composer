"use client"

import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs"
import { CheckoutButton } from "@clerk/nextjs/experimental"

const PLANS = [
  {
    id: "creator",
    label: "Creator",
    planId: "cplan_3AMe0aHz06gksOmyElvNhhLEzr2",
    price: "$29",
    period: "month",
    features: [
      "25 generations / day",
      "500 characters per script",
      "All 5 voices",
      "History & auto-save",
    ],
    highlighted: false,
  },
  {
    id: "studio",
    label: "Studio",
    planId: "cplan_3AMe5c5UiyUse0fOdtMwkcbQ9wC",
    price: "$99",
    period: "month",
    features: [
      "100 generations / day",
      "2,000 characters per script",
      "All 5 voices",
      "History & auto-save",
      "Projects (coming soon)",
    ],
    highlighted: true,
  },
] as const

export default function UpgradePage() {
  return (
    <>
      <SignedIn>
        <UpgradeContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/upgrade" />
      </SignedOut>
    </>
  )
}

function UpgradeContent() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Topbar */}
      <header style={{
        height: "52px", padding: "0 24px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid #eae4de",
        background: "rgba(248,246,243,0.96)",
      }}>
        <a href="/composer" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", color: "#2a2622", textTransform: "uppercase" }}>
            Lyric
          </span>
        </a>
      </header>

      {/* Main */}
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "64px 24px" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em", color: "#2a2622", margin: "0 0 12px" }}>
            Choose your plan
          </h1>
          <p style={{ fontSize: "14px", color: "#756d65", lineHeight: 1.6, margin: 0 }}>
            All plans include access to all 5 voices, history, and auto-save.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: "#ffffff",
                border: `1.5px solid ${plan.highlighted ? "#c4977f" : "#eae4de"}`,
                borderRadius: "16px",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                boxShadow: plan.highlighted ? "0 2px 16px rgba(196,151,127,0.15)" : "none",
              }}
            >
              {/* Plan name + price */}
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#b5aca3", textTransform: "uppercase", margin: "0 0 8px" }}>
                  {plan.label}
                </p>
                <p style={{ fontSize: "28px", fontWeight: 600, color: "#2a2622", letterSpacing: "-0.02em", margin: 0, lineHeight: 1 }}>
                  {plan.price}
                  <span style={{ fontSize: "13px", fontWeight: 400, color: "#9c958f", marginLeft: "4px" }}>
                    / {plan.period}
                  </span>
                </p>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{ fontSize: "13px", color: "#756d65", display: "flex", alignItems: "flex-start", gap: "8px", lineHeight: 1.4 }}
                  >
                    <span style={{ color: "#c4977f", fontSize: "11px", marginTop: "2px", flexShrink: 0 }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Checkout button */}
              <CheckoutButton
                planId={plan.planId}
                planPeriod="month"
                newSubscriptionRedirectUrl="https://composer.lyricvoices.com"
              >
                <button
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: "10px",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    background: plan.highlighted ? "#2a2622" : "#eae4de",
                    color: plan.highlighted ? "#f8f6f3" : "#2a2622",
                    transition: "all 0.15s",
                  }}
                >
                  Subscribe to {plan.label}
                </button>
              </CheckoutButton>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#b5aca3", marginTop: "32px", lineHeight: 1.6 }}>
          Payments processed securely by Stripe.{" "}
          Need Enterprise?{" "}
          <a href="mailto:hello@lyricvoices.com" style={{ color: "#756d65", textDecoration: "none" }}>
            Contact us.
          </a>
        </p>

      </main>
    </div>
  )
}
