"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Wordmark from "@/components/Wordmark"

const DARK = "#2b2a25"
const LIGHT = "#f5f3ef"
const MUTED = "rgba(245,243,239,0.45)"
const BORDER = "rgba(255,255,255,0.08)"

export default function ReturnPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: DARK }} />}>
      <ReturnContent />
    </Suspense>
  )
}

function ReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (!sessionId) {
      setStatus("error")
      return
    }

    // Redirect to composer on success
    setStatus("success")
    const timer = setTimeout(() => {
      router.replace("/composer?checkout=success")
    }, 2000)

    return () => clearTimeout(timer)
  }, [searchParams, router])

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: DARK,
    }}>
      <header style={{
        height: "52px",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <Wordmark height={32} color={LIGHT} />
      </header>

      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          {status === "loading" && (
            <p style={{ fontSize: "14px", color: MUTED }}>Processing...</p>
          )}
          {status === "success" && (
            <>
              <p style={{
                fontSize: "20px",
                fontWeight: 600,
                color: LIGHT,
                margin: "0 0 8px",
              }}>
                You&apos;re all set
              </p>
              <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>
                Redirecting to the composer...
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <p style={{
                fontSize: "20px",
                fontWeight: 600,
                color: LIGHT,
                margin: "0 0 8px",
              }}>
                Something went wrong
              </p>
              <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>
                <a href="/upgrade" style={{ color: "#c1c17e", textDecoration: "none" }}>
                  &larr; Back to plans
                </a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
