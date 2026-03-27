"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const MARKETING_URL = "https://lyricvoices.ai"

const PLANS = [
  {
    id: "creator",
    label: "Creator",
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
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const router = useRouter()

  // Guard: redirect to sign-in if no session
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) router.replace("/sign-in")
  })

  async function handleCheckout(planId: string) {
    setLoadingPlan(planId)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("[upgrade] No checkout URL:", data)
        setLoadingPlan(null)
      }
    } catch (err) {
      console.error("[upgrade] Checkout error:", err)
      setLoadingPlan(null)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f6f3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Topbar */}
      <header style={{
        height: "52px", padding: "0 24px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid #eae4de",
        background: "rgba(248,246,243,0.96)",
      }}>
        <a href={MARKETING_URL} style={{ textDecoration: "none" }}>
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
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: loadingPlan !== null ? "not-allowed" : "pointer",
                  background: plan.highlighted ? "#2a2622" : "#eae4de",
                  color: plan.highlighted ? "#f8f6f3" : "#2a2622",
                  opacity: loadingPlan !== null ? 0.7 : 1,
                  transition: "all 0.15s",
                }}
              >
                {loadingPlan === plan.id ? "Redirecting to Stripe…" : `Subscribe to ${plan.label}`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#b5aca3", marginTop: "32px", lineHeight: 1.6 }}>
          Payments processed securely by Stripe.{" "}
          Need Enterprise?{" "}
          <a href="mailto:hello@lyricvoices.ai" style={{ color: "#756d65", textDecoration: "none" }}>
            Contact us.
          </a>
        </p>

      </main>
    </div>
  )
}
