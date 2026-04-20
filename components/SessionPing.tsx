"use client"

import { useEffect } from "react"

const STORAGE_KEY = "lyric:session_started_at"
const TTL_MS = 30 * 60 * 1000 // 30 min — matches a "session" of activity

export default function SessionPing() {
  useEffect(() => {
    try {
      const last = sessionStorage.getItem(STORAGE_KEY)
      if (last && Date.now() - Number(last) < TTL_MS) return
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      // private mode / disabled storage — ping anyway
    }

    fetch("/api/session/start", { method: "POST", credentials: "same-origin" }).catch(() => {})
  }, [])

  return null
}
