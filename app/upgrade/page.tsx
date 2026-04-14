"use client"

import { Suspense, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import Wordmark from "@/components/Wordmark"

const MARKETING_URL = "https://lyricvoices.ai"

// ── Design tokens ────────────────────────────────────────────────────────────
const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const GOLD = "#c9a96e"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(255,255,255,0.08)"

const FEATURES = [
  "25 generations per day",
  "500 characters per script",
  "All 5 voices and tonal variants",
  "Inline direction marks",
  "History and auto-save",
]

const TOAST_MESSAGES: Record<string, string> = {
  expired: "Your trial or subscription has ended. Choose a plan to continue using the composer.",
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#2b2a25" }} />
    }>
      <UpgradeContent />
    </Suspense>
  )
}

function UpgradeContent() {
  const [loading, setLoading] = useState(false)
  const [hasAccount, setHasAccount] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check auth state — if user already has an active plan, redirect to composer
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/sign-up")
        return
      }
      setHasAccount(true)

      const meta = user.app_metadata ?? {}
      const hasPlan = meta.plan_tier && meta.plan_tier !== "none" && meta.plan_tier !== "expired"
      const hasTrial = meta.trial_ends_at && new Date(meta.trial_ends_at) > new Date()
      if (hasPlan || hasTrial) {
        const dest = meta.onboarding_complete ? "/" : "/onboarding"
        router.replace(dest)
      }
    })
  }, [router])

  // Show toast if reason param is present
  useEffect(() => {
    const reason = searchParams.get("reason")
    if (reason && TOAST_MESSAGES[reason]) {
      setToast(TOAST_MESSAGES[reason])
      // Animate in
      requestAnimationFrame(() => setToastVisible(true))
      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        setToastVisible(false)
        setTimeout(() => setToast(null), 300)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  async function handleStartTrial() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "creator", trial: true }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("[upgrade] No checkout URL:", data)
        setLoading(false)
      }
    } catch (err) {
      console.error("[upgrade] Checkout error:", err)
      setLoading(false)
    }
  }

  async function handleSubscribe(planId: string) {
    setLoading(true)
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
        setLoading(false)
      }
    } catch (err) {
      console.error("[upgrade] Checkout error:", err)
      setLoading(false)
    }
  }

  if (!hasAccount) return null

  return (
    <>
      <style>{`
        .upgrade-btn { transition: all 0.15s; }
        .upgrade-btn:not(:disabled):hover { opacity: 0.9 !important; }
        .plan-toggle { transition: color 0.15s; }
        .plan-toggle:hover { color: ${LIGHT} !important; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: DARK,
      }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            maxWidth: "480px",
            width: "calc(100% - 48px)",
            padding: "14px 20px",
            borderRadius: "12px",
            background: "rgba(43,42,37,0.95)",
            border: `1px solid rgba(201,169,110,0.25)`,
            backdropFilter: "blur(16px)",
            color: LIGHT,
            fontSize: "13px",
            lineHeight: 1.5,
            textAlign: "center",
            opacity: toastVisible ? 1 : 0,
            transition: "opacity 0.3s ease",
            animation: toastVisible ? "toast-in 0.3s ease" : "none",
          }}>
            {toast}
          </div>
        )}

        {/* Topbar */}
        <header style={{
          height: "52px", padding: "0 24px",
          display: "flex", alignItems: "center",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <a href={MARKETING_URL} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Wordmark height={32} color={LIGHT} />
          </a>
        </header>

        {/* Main */}
        <main style={{
          flex: 1, display: "flex",
          alignItems: "center", justifyContent: "center",
          padding: "48px 24px",
        }}>
          <div style={{
            width: "100%", maxWidth: "420px",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "32px",
          }}>
            {/* Heading */}
            <div style={{ textAlign: "center" }}>
              <h1 style={{
                fontSize: "24px", fontWeight: 600,
                letterSpacing: "-0.02em", color: LIGHT,
                margin: "0 0 12px",
              }}>
                {searchParams.get("reason") === "expired"
                  ? "Welcome back"
                  : "Start your free trial"}
              </h1>
              <p style={{
                fontSize: "14px", color: MUTED,
                lineHeight: 1.6, margin: 0,
              }}>
                7 days free on the Creator plan. $29/mo after.
                <br />
                Cancel anytime before your trial ends.
              </p>
            </div>

            {/* Feature list */}
            <div style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${BORDER}`,
              borderRadius: "14px",
              padding: "24px 28px",
            }}>
              <p style={{
                fontSize: "10px", fontWeight: 700,
                letterSpacing: "0.15em", color: GOLD,
                textTransform: "uppercase", margin: "0 0 16px",
              }}>
                What you get
              </p>
              <ul style={{
                listStyle: "none", padding: 0, margin: 0,
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      fontSize: "15px", color: LIGHT,
                      display: "flex", alignItems: "center",
                      gap: "10px", lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: GOLD, fontSize: "11px", flexShrink: 0 }}>&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <button
              className="upgrade-btn"
              onClick={handleStartTrial}
              disabled={loading}
              style={{
                width: "100%", padding: "14px",
                borderRadius: "100px", border: "none",
                background: GOLD,
                color: DARK,
                fontSize: "14px", fontWeight: 600,
                letterSpacing: "-0.01em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Redirecting to checkout\u2026" : "Start 7-day free trial"}
            </button>

            {/* Subscribe directly toggle */}
            {!showPlans ? (
              <button
                className="plan-toggle"
                onClick={() => setShowPlans(true)}
                style={{
                  background: "none", border: "none",
                  color: MUTED, fontSize: "12px",
                  cursor: "pointer", padding: 0,
                }}
              >
                Or subscribe directly without a trial
              </button>
            ) : (
              <div style={{
                width: "100%",
                display: "flex", flexDirection: "column",
                gap: "10px",
              }}>
                <p style={{
                  fontSize: "11px", color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em", margin: "0 0 4px",
                  textAlign: "center",
                }}>
                  Subscribe now
                </p>

                {/* Creator */}
                <button
                  className="upgrade-btn"
                  onClick={() => handleSubscribe("creator")}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px 20px",
                    borderRadius: "10px",
                    border: `1px solid ${BORDER}`,
                    background: "rgba(255,255,255,0.04)",
                    color: LIGHT,
                    fontSize: "13px", fontWeight: 500,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <span>Creator</span>
                  <span style={{ color: MUTED }}>$29 / mo</span>
                </button>

                {/* Studio */}
                <button
                  className="upgrade-btn"
                  onClick={() => handleSubscribe("studio")}
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px 20px",
                    borderRadius: "10px",
                    border: `1px solid rgba(201,169,110,0.3)`,
                    background: "rgba(201,169,110,0.06)",
                    color: LIGHT,
                    fontSize: "13px", fontWeight: 500,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <span>Studio</span>
                  <span style={{ color: GOLD }}>$99 / mo</span>
                </button>

                {/* Enterprise */}
                <p style={{
                  fontSize: "12px", color: MUTED,
                  textAlign: "center", margin: "4px 0 0",
                  lineHeight: 1.6,
                }}>
                  Need Enterprise?{" "}
                  <a
                    href="mailto:hello@lyricvoices.ai"
                    style={{ color: GOLD, textDecoration: "none" }}
                  >
                    Contact us
                  </a>
                </p>
              </div>
            )}

            {/* Stripe footer */}
            <p style={{
              fontSize: "11px", color: "rgba(245,243,239,0.2)",
              textAlign: "center", margin: 0, lineHeight: 1.5,
            }}>
              Payments processed securely by Stripe
            </p>
          </div>
        </main>
      </div>
    </>
  )
}
