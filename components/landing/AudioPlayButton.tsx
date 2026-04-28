"use client"

import { useEffect, useRef, useState } from "react"
import { track } from "./track"

interface Props {
  sampleUrl: string
  voiceId: string
  voiceName: string
  variant?: "light" | "dark"
}

/**
 * Lazy-loaded voice sample player. Audio element is only constructed when
 * the user clicks play, so the page does not preload audio for all 5 voices.
 * Pauses any other instance on the page when this one starts.
 */
const ACTIVE = { current: null as HTMLAudioElement | null }

export default function AudioPlayButton({
  sampleUrl,
  voiceId,
  voiceName,
  variant = "light",
}: Props) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function toggle() {
    if (!audioRef.current) {
      const a = new Audio(sampleUrl)
      a.preload = "auto"
      a.onended = () => setPlaying(false)
      a.onpause = () => setPlaying(false)
      a.onplay = () => setPlaying(true)
      audioRef.current = a
    }

    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      return
    }

    if (ACTIVE.current && ACTIVE.current !== audioRef.current) {
      ACTIVE.current.pause()
      ACTIVE.current.currentTime = 0
    }
    ACTIVE.current = audioRef.current

    setLoading(true)
    audioRef.current
      .play()
      .then(() => {
        setLoading(false)
        track("landing_audio_play", { voiceId })
      })
      .catch(() => {
        setLoading(false)
        setPlaying(false)
      })
  }

  const isDark = variant === "dark"
  const bg = playing
    ? isDark ? "rgba(245,243,239,0.18)" : "rgba(28,25,23,0.2)"
    : isDark ? "rgba(245,243,239,0.10)" : "rgba(28,25,23,0.10)"
  const color = isDark ? "#f5f3ef" : "#1c1917"
  const border = isDark ? "1px solid rgba(245,243,239,0.18)" : "1px solid rgba(28,25,23,0.10)"

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Pause ${voiceName} sample` : `Play ${voiceName} sample`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        background: bg,
        color,
        borderRadius: "100px",
        border,
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "background 0.15s",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ fontSize: "10px", lineHeight: 1 }}>
        {loading ? "…" : playing ? "❚❚" : "▶"}
      </span>
      {playing ? `Playing ${voiceName.split(" · ")[0]}` : `Hear ${voiceName.split(" · ")[0]}`}
    </button>
  )
}
