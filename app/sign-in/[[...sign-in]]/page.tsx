"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Wordmark from "@/components/Wordmark"

// ── Design tokens ────────────────────────────────────────────────────────────
const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const GOLD = "#c9a96e"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(255,255,255,0.08)"
const INPUT_BG = "rgba(255,255,255,0.06)"

type Step = "input" | "otp"

function isPhoneInput(value: string): boolean {
  return value.trimStart().startsWith("+")
}

export default function SignInPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("input")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unified input (email or phone)
  const [credential, setCredential] = useState("")
  const isPhone = isPhoneInput(credential)

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

  // ── Email / Phone OTP ─────────────────────────────────────────────────────
  async function handleCredentialSubmit() {
    const value = credential.trim()
    if (!value) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const otpPayload = isPhone
      ? { phone: value, options: { shouldCreateUser: true } }
      : { email: value, options: { shouldCreateUser: true } }

    const { error: otpError } = await supabase.auth.signInWithOtp(otpPayload)
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

    const value = credential.trim()
    const verifyPayload = isPhone
      ? { phone: value, token: otp, type: "sms" as const }
      : { email: value, token: otp, type: "email" as const }

    const { error: verifyError } = await supabase.auth.verifyOtp(verifyPayload)
    if (verifyError) {
      setLoading(false)
      setError(verifyError.message)
      return
    }

    // Ensure user_profiles row exists
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
        .auth-btn { transition: all 0.15s; }
        .auth-btn:not(:disabled):hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.2) !important; }
        .auth-input { transition: border-color 0.15s; }
        .auth-input:focus { border-color: ${GOLD} !important; outline: none; }
        .auth-input::placeholder { color: rgba(245,243,239,0.25); }
        .auth-link:hover { color: ${LIGHT} !important; }
        .auth-gold:not(:disabled):hover { opacity: 0.9 !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: DARK,
      }}>
        <div style={{
          width: "100%",
          maxWidth: "380px",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px",
        }}>
          {/* Wordmark */}
          <Wordmark height={32} color={LIGHT} />

          {/* Heading */}
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 600, color: LIGHT, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              Sign in to Lyric
            </h1>
            <p style={{ fontSize: "13px", color: MUTED, margin: 0, lineHeight: 1.5 }}>
              Continue to the composer
            </p>
          </div>

          {step === "input" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Google button */}
              <button
                className="auth-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
                style={{
                  width: "100%", padding: "12px 20px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: INPUT_BG, color: LIGHT,
                  fontSize: "14px", fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: "10px",
                  opacity: loading ? 0.6 : 1,
                  transition: "opacity 0.15s",
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

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.05em" }}>or</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Email / phone input */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  className="auth-input"
                  type={isPhone ? "tel" : "email"}
                  placeholder="Email or phone number"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCredentialSubmit()}
                  style={{
                    width: "100%", padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: INPUT_BG, color: LIGHT,
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {isPhone && (
                  <p style={{ fontSize: "11px", color: MUTED, margin: 0, lineHeight: 1.4 }}>
                    Include country code (e.g. +1 for US)
                  </p>
                )}
                <button
                  className="auth-gold"
                  onClick={handleCredentialSubmit}
                  disabled={loading || !credential.trim()}
                  style={{
                    width: "100%", padding: "12px",
                    borderRadius: "10px", border: "none",
                    background: credential.trim() && !loading ? GOLD : "rgba(201,169,110,0.3)",
                    color: credential.trim() && !loading ? DARK : "rgba(43,42,37,0.5)",
                    fontSize: "14px", fontWeight: 600,
                    cursor: credential.trim() && !loading ? "pointer" : "default",
                    transition: "all 0.15s",
                  }}
                >
                  {loading ? "Sending code\u2026" : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── OTP verification ──────────────────────────────────────────── */}
          {step === "otp" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
              <p style={{ fontSize: "13px", color: MUTED, margin: 0, lineHeight: 1.5, textAlign: "center" }}>
                We sent a 6-digit code to{" "}
                <span style={{ color: LIGHT }}>{credential.trim()}</span>
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
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: INPUT_BG, color: LIGHT,
                  fontSize: "20px", fontWeight: 600,
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
              <button
                className="auth-gold"
                onClick={handleOtpVerify}
                disabled={loading || otp.length < 6}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "10px", border: "none",
                  background: otp.length >= 6 && !loading ? GOLD : "rgba(201,169,110,0.3)",
                  color: otp.length >= 6 && !loading ? DARK : "rgba(43,42,37,0.5)",
                  fontSize: "14px", fontWeight: 600,
                  cursor: otp.length >= 6 && !loading ? "pointer" : "default",
                  transition: "all 0.15s",
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
                }}
              >
                Try a different method
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
