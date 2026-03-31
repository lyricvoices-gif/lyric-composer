"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// ── Design tokens (match onboarding) ────────────────────────────────────────
const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const GOLD = "#c9a96e"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(255,255,255,0.08)"
const BORDER_HOVER = "rgba(255,255,255,0.16)"
const INPUT_BG = "rgba(255,255,255,0.06)"

type AuthMethod = "google" | "email" | "phone"
type Step = "input" | "otp"

export default function SignInPage() {
  const router = useRouter()
  const [method, setMethod] = useState<AuthMethod>("google")
  const [step, setStep] = useState<Step>("input")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Email state
  const [email, setEmail] = useState("")

  // Phone state
  const [phone, setPhone] = useState("")

  // OTP state
  const [otp, setOtp] = useState("")

  function resetState() {
    setStep("input")
    setOtp("")
    setError(null)
    setLoading(false)
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────
  async function handleEmailSubmit() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setStep("otp")
  }

  // ── Phone OTP ─────────────────────────────────────────────────────────────
  async function handlePhoneSubmit() {
    const cleaned = phone.trim()
    if (!cleaned) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: cleaned,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setStep("otp")
  }

  // ── OTP verification ─────────────────────────────────────────────────────
  async function handleOtpVerify() {
    if (otp.length < 6) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const verifyPayload =
      method === "email"
        ? { email: email.trim(), token: otp, type: "email" as const }
        : { phone: phone.trim(), token: otp, type: "sms" as const }

    const { error: verifyError } = await supabase.auth.verifyOtp(verifyPayload)
    if (verifyError) {
      setLoading(false)
      setError(verifyError.message)
      return
    }

    // Ensure user_profiles row exists (non-blocking on error)
    try {
      await fetch("/api/provision-user", { method: "POST" })
    } catch {
      // Non-fatal
    }

    router.push("/composer")
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .auth-tab { transition: all 0.15s; }
        .auth-tab:hover { color: ${LIGHT} !important; }
        .auth-btn { transition: all 0.15s; }
        .auth-btn:not(:disabled):hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.2) !important; }
        .auth-input { transition: border-color 0.15s; }
        .auth-input:focus { border-color: ${GOLD} !important; outline: none; }
        .auth-input::placeholder { color: rgba(245,243,239,0.25); }
        .auth-link:hover { color: ${LIGHT} !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: DARK,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${BORDER}`,
          borderRadius: "16px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
        }}>
          {/* Wordmark */}
          <p style={{
            fontSize: "13px", fontWeight: 700,
            letterSpacing: "0.2em", color: LIGHT,
            textTransform: "uppercase", margin: 0,
          }}>
            lyric
          </p>

          {/* Heading */}
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 600, color: LIGHT, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              Sign in to Lyric
            </h1>
            <p style={{ fontSize: "13px", color: MUTED, margin: 0, lineHeight: 1.5 }}>
              Continue to the composer
            </p>
          </div>

          {/* Method tabs */}
          {step === "input" && (
            <div style={{
              display: "flex", gap: "0",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "8px", padding: "3px",
              width: "100%",
            }}>
              {([
                { id: "google" as AuthMethod, label: "Google" },
                { id: "email" as AuthMethod, label: "Email" },
                { id: "phone" as AuthMethod, label: "Phone" },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  className="auth-tab"
                  onClick={() => { setMethod(tab.id); setError(null) }}
                  style={{
                    flex: 1, padding: "8px 0",
                    borderRadius: "6px", border: "none",
                    fontSize: "12px", fontWeight: 500,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    background: method === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                    color: method === tab.id ? LIGHT : MUTED,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Google ────────────────────────────────────────────────────── */}
          {step === "input" && method === "google" && (
            <button
              className="auth-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: "100%", padding: "12px 20px",
                borderRadius: "10px",
                border: `1px solid rgba(255,255,255,0.12)`,
                background: INPUT_BG, color: LIGHT,
                fontSize: "14px", fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "10px",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {loading ? "Redirecting\u2026" : "Continue with Google"}
            </button>
          )}

          {/* ── Email input ───────────────────────────────────────────────── */}
          {step === "input" && method === "email" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                autoFocus
                style={{
                  width: "100%", padding: "12px 16px",
                  borderRadius: "10px",
                  border: `1px solid rgba(255,255,255,0.12)`,
                  background: INPUT_BG, color: LIGHT,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <button
                className="auth-btn"
                onClick={handleEmailSubmit}
                disabled={loading || !email.trim()}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "10px", border: "none",
                  background: email.trim() && !loading ? GOLD : "rgba(201,169,110,0.3)",
                  color: email.trim() && !loading ? DARK : "rgba(43,42,37,0.5)",
                  fontSize: "14px", fontWeight: 600,
                  cursor: email.trim() && !loading ? "pointer" : "default",
                }}
              >
                {loading ? "Sending code\u2026" : "Send sign-in code"}
              </button>
            </div>
          )}

          {/* ── Phone input ───────────────────────────────────────────────── */}
          {step === "input" && method === "phone" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                className="auth-input"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                autoFocus
                style={{
                  width: "100%", padding: "12px 16px",
                  borderRadius: "10px",
                  border: `1px solid rgba(255,255,255,0.12)`,
                  background: INPUT_BG, color: LIGHT,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: "11px", color: MUTED, margin: 0, lineHeight: 1.4 }}>
                Include country code (e.g. +1 for US)
              </p>
              <button
                className="auth-btn"
                onClick={handlePhoneSubmit}
                disabled={loading || !phone.trim()}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "10px", border: "none",
                  background: phone.trim() && !loading ? GOLD : "rgba(201,169,110,0.3)",
                  color: phone.trim() && !loading ? DARK : "rgba(43,42,37,0.5)",
                  fontSize: "14px", fontWeight: 600,
                  cursor: phone.trim() && !loading ? "pointer" : "default",
                }}
              >
                {loading ? "Sending code\u2026" : "Send sign-in code"}
              </button>
            </div>
          )}

          {/* ── OTP verification ──────────────────────────────────────────── */}
          {step === "otp" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "13px", color: MUTED, margin: 0, lineHeight: 1.5, textAlign: "center" }}>
                {method === "email"
                  ? `We sent a 6-digit code to ${email}`
                  : `We sent a 6-digit code to ${phone}`}
              </p>
              <input
                className="auth-input"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleOtpVerify()}
                autoFocus
                style={{
                  width: "100%", padding: "14px 16px",
                  borderRadius: "10px",
                  border: `1px solid rgba(255,255,255,0.12)`,
                  background: INPUT_BG, color: LIGHT,
                  fontSize: "20px", fontWeight: 600,
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
              <button
                className="auth-btn"
                onClick={handleOtpVerify}
                disabled={loading || otp.length < 6}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "10px", border: "none",
                  background: otp.length >= 6 && !loading ? GOLD : "rgba(201,169,110,0.3)",
                  color: otp.length >= 6 && !loading ? DARK : "rgba(43,42,37,0.5)",
                  fontSize: "14px", fontWeight: 600,
                  cursor: otp.length >= 6 && !loading ? "pointer" : "default",
                }}
              >
                {loading ? "Verifying\u2026" : "Verify code"}
              </button>
              <button
                className="auth-link"
                onClick={resetState}
                style={{
                  background: "none", border: "none",
                  color: MUTED, fontSize: "12px",
                  cursor: "pointer", padding: 0,
                  textAlign: "center",
                }}
              >
                Use a different method
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p style={{ fontSize: "12px", color: "#e5736a", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          {/* Footer link */}
          <p style={{ fontSize: "12px", color: "rgba(245,243,239,0.25)", margin: 0, textAlign: "center", lineHeight: 1.6 }}>
            Don&apos;t have an account?{" "}
            <a href="/sign-up" className="auth-link" style={{ color: "rgba(245,243,239,0.5)", textDecoration: "none" }}>
              Start free trial
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
