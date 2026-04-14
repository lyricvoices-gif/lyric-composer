"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"
import Wordmark from "@/components/Wordmark"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

// ── Lyric brand tokens ──────────────────────────────────────────────────────
const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const GOLD = "#c9a96e"
const BRAND_OLIVE = "#5a5e43"
const BRAND_GOLD = "#c1c17e"
const BORDER = "rgba(255,255,255,0.08)"
const MUTED = "rgba(245,243,239,0.45)"

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: DARK }} />}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan") ?? "creator"
  const trial = searchParams.get("trial") === "true"

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, trial }),
    })
    const data = await res.json()
    return data.clientSecret
  }, [planId, trial])

  const options = {
    fetchClientSecret,
  }

  const planLabel = planId === "studio" ? "Studio" : "Creator"
  const planPrice = planId === "studio" ? "$99/mo" : "$29/mo"

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column" as const,
      background: DARK,
    }}>
      {/* Header */}
      <header style={{
        height: "52px",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <a href="/upgrade" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <Wordmark height={32} color={LIGHT} />
        </a>
      </header>

      {/* Main */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 24px",
      }}>
        <div style={{
          width: "100%",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column" as const,
          gap: "24px",
        }}>
          {/* Plan summary */}
          <div style={{ textAlign: "center" as const }}>
            <h1 style={{
              fontSize: "20px",
              fontWeight: 600,
              color: LIGHT,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}>
              {trial ? "Start your free trial" : `Subscribe to ${planLabel}`}
            </h1>
            <p style={{
              fontSize: "13px",
              color: MUTED,
              margin: 0,
              lineHeight: 1.6,
            }}>
              {trial
                ? "7 days free on the Creator plan. $29/mo after."
                : `${planLabel} plan \u2014 ${planPrice}`}
            </p>
          </div>

          {/* Embedded Checkout */}
          <div style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: `1px solid ${BORDER}`,
          }}>
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>

          {/* Back link */}
          <p style={{
            fontSize: "12px",
            color: MUTED,
            textAlign: "center" as const,
            margin: 0,
          }}>
            <a
              href="/upgrade"
              style={{ color: BRAND_GOLD, textDecoration: "none" }}
            >
              &larr; Back to plans
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
