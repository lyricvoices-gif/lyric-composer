"use client"

import { useEffect, useRef } from "react"
import { track } from "./track"

interface Props {
  section: string
  children: React.ReactNode
  style?: React.CSSProperties
}

/**
 * Wraps a section and fires a `landing_section_visible` event the first time
 * the section enters the viewport. Used for funnel drop-off analysis.
 */
export default function SectionTracker({ section, children, style }: Props) {
  const ref = useRef<HTMLElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || fired.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true
          track("landing_section_visible", { section })
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [section])

  return (
    <section ref={ref} data-section={section} style={style}>
      {children}
    </section>
  )
}
