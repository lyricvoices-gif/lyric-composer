"use client"

import { useEffect } from "react"
import Hero from "./Hero"
import VoiceShowcase from "./VoiceShowcase"
import ComposerDemo from "./ComposerDemo"
import EthicsSection from "./EthicsSection"
import PricingSection from "./PricingSection"
import SocialProof from "./SocialProof"
import FinalCta from "./FinalCta"
import LandingFooter from "./LandingFooter"
import SectionTracker from "./SectionTracker"
import { track } from "./track"

/**
 * Top-level landing page composition.
 * Sections are ordered for the funnel: hook → belief → demo → trust → price → proof → close.
 * Each block is a separate component so headlines, ordering, and CTAs can be A/B-swapped
 * without refactoring the page.
 */
export default function LandingPage() {
  useEffect(() => {
    track("landing_page_view", {
      referrer: document.referrer || null,
      utm: extractUtm(window.location.search),
    })
  }, [])

  return (
    <main>
      <SectionTracker section="hero">
        <Hero />
      </SectionTracker>

      <SectionTracker section="voices">
        <VoiceShowcase />
      </SectionTracker>

      <SectionTracker section="demo">
        <ComposerDemo />
      </SectionTracker>

      <SectionTracker section="ethics">
        <EthicsSection />
      </SectionTracker>

      <SectionTracker section="pricing">
        <PricingSection />
      </SectionTracker>

      <SectionTracker section="proof">
        <SocialProof />
      </SectionTracker>

      <SectionTracker section="final_cta">
        <FinalCta />
      </SectionTracker>

      <LandingFooter />
    </main>
  )
}

function extractUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const out: Record<string, string> = {}
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = params.get(k)
    if (v) out[k] = v
  }
  return out
}
