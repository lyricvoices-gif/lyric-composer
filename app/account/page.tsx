"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getPlanConfig, isTrialActive, trialDaysRemaining } from "@/lib/planConfig"
import type { PlanId } from "@/lib/planConfig"
import Wordmark from "@/components/Wordmark"

const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const GOLD = "#c9a96e"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(255,255,255,0.08)"

export default function AccountPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanId | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/sign-in")
        return
      }
      const meta = user.app_metadata ?? {}
      setPlan((meta.plan_tier as PlanId) ?? null)
      setTrialEndsAt((meta.trial_ends_at as string) ?? null)
      setLoaded(true)
    })
  }, [router])

  const isTrial = isTrialActive(trialEndsAt)
  const daysLeft = trialDaysRemaining(trialEndsAt)
  const planConfig = getPlanConfig(plan)
  const hasActivePlan = plan && plan !== "expired" && plan !== "none"
  const isEnterprise = plan === "enterprise"

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch("/api/cancel-subscription", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        window.location.replace("/upgrade?reason=expired")
      } else {
        console.error("[account] Cancel failed:", data.error)
        setCancelling(false)
        setShowConfirm(false)
      }
    } catch (err) {
      console.error("[account] Cancel error:", err)
      setCancelling(false)
      setShowConfirm(false)
    }
  }

  if (!loaded) {
    return <div style={{ minHeight: "100vh", background: DARK }} />
  }

  return (
    <>
      <style>{`
        .acct-back { transition: color 0.15s; }
        .acct-back:hover { color: ${LIGHT} !important; }
        .acct-cancel-link { transition: color 0.15s; }
        .acct-cancel-link:hover { color: rgba(245,243,239,0.65) !important; }
        .acct-confirm-btn { transition: all 0.15s; }
        .acct-confirm-btn:not(:disabled):hover { opacity: 0.85 !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: DARK,
      }}>
        {/* Topbar */}
        <header style={{
          height: "52px", padding: "0 24px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <a href="/composer" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Wordmark height={32} color={LIGHT} />
          </a>
          <a
            href="/composer"
            className="acct-back"
            style={{
              fontSize: "13px", color: MUTED,
              textDecoration: "none",
            }}
          >
            ← Back to composer
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
            <h1 style={{
              fontSize: "24px", fontWeight: 600,
              letterSpacing: "-0.02em", color: LIGHT,
              margin: 0, textAlign: "center",
            }}>
              Manage subscription
            </h1>

            {!hasActivePlan ? (
              /* No active plan */
              <div style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "14px",
                padding: "32px 28px",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "15px", color: LIGHT, margin: "0 0 16px" }}>
                  No active subscription
                </p>
                <a
                  href="/upgrade"
                  style={{
                    fontSize: "13px", color: GOLD,
                    textDecoration: "none",
                  }}
                >
                  Choose a plan →
                </a>
              </div>
            ) : (
              /* Active plan card */
              <div style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "14px",
                padding: "28px",
              }}>
                {/* Plan name */}
                <div style={{ marginBottom: "24px" }}>
                  <p style={{
                    fontSize: "10px", fontWeight: 700,
                    letterSpacing: "0.15em", color: GOLD,
                    textTransform: "uppercase", margin: "0 0 8px",
                  }}>
                    Current plan
                  </p>
                  <p style={{
                    fontSize: "20px", fontWeight: 600,
                    color: LIGHT, margin: 0,
                    letterSpacing: "-0.01em",
                  }}>
                    {planConfig.label}
                  </p>
                </div>

                {/* Status */}
                <div style={{
                  padding: "16px 0",
                  borderTop: `1px solid ${BORDER}`,
                  borderBottom: `1px solid ${BORDER}`,
                  marginBottom: "24px",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>Status</p>
                    <p style={{ fontSize: "13px", color: LIGHT, margin: 0 }}>
                      {isTrial ? "Trial" : "Active"}
                    </p>
                  </div>
                  {isTrial && (
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginTop: "10px",
                    }}>
                      <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>Trial ends</p>
                      <p style={{ fontSize: "13px", color: LIGHT, margin: 0 }}>
                        {daysLeft === 0
                          ? "Today"
                          : daysLeft === 1
                            ? "Tomorrow"
                            : `In ${daysLeft} days`}
                      </p>
                    </div>
                  )}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginTop: "10px",
                  }}>
                    <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>Daily generations</p>
                    <p style={{ fontSize: "13px", color: LIGHT, margin: 0 }}>
                      {planConfig.dailyGenerationLimit === -1 ? "Unlimited" : planConfig.dailyGenerationLimit}
                    </p>
                  </div>
                </div>

                {/* Cancel section */}
                {isEnterprise ? (
                  <p style={{ fontSize: "12px", color: MUTED, margin: 0 }}>
                    To manage your Enterprise plan,{" "}
                    <a href="mailto:hello@lyricvoices.ai" style={{ color: GOLD, textDecoration: "none" }}>
                      contact us
                    </a>
                  </p>
                ) : !showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="acct-cancel-link"
                    style={{
                      background: "none", border: "none",
                      color: "rgba(245,243,239,0.3)",
                      fontSize: "12px", cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div>
                    <p style={{
                      fontSize: "13px", color: MUTED,
                      margin: "0 0 14px", lineHeight: 1.5,
                    }}>
                      Are you sure? Your access will end immediately.
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="acct-confirm-btn"
                        style={{
                          padding: "8px 16px",
                          borderRadius: "100px",
                          border: `1px solid ${BORDER}`,
                          background: "transparent",
                          color: MUTED,
                          fontSize: "12px", fontWeight: 500,
                          cursor: cancelling ? "not-allowed" : "pointer",
                          opacity: cancelling ? 0.5 : 1,
                        }}
                      >
                        {cancelling ? "Cancelling\u2026" : "Yes, cancel"}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="acct-confirm-btn"
                        style={{
                          padding: "8px 16px",
                          borderRadius: "100px",
                          border: "none",
                          background: GOLD,
                          color: DARK,
                          fontSize: "12px", fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Never mind
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
