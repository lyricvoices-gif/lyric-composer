import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LandingPage from "@/components/landing/LandingPage"

export const metadata: Metadata = {
  metadataBase: new URL("https://composer.lyricvoices.ai"),
  title: "Lyric Composer · Direct AI voices with intent",
  description:
    "Direct five voice artists with intent, emotion, and pacing. Generate broadcast-ready audio in seconds. Composed, not cloned.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://composer.lyricvoices.ai",
    siteName: "Lyric Composer",
    title: "Voice artists build the voices. You compose with them.",
    description:
      "AI voice direction for creators, brands, and product teams. Five voices, real artists, real partnerships. Start your 7-day free trial.",
    images: [
      {
        url: "/landing/images/about-soft.webp",
        width: 1200,
        height: 630,
        alt: "Lyric Composer — Edition 01",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voice artists build the voices. You compose with them.",
    description:
      "AI voice direction with five real-artist voices. Composed, not cloned. Free 7-day trial.",
    images: ["/landing/images/about-soft.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

/**
 * Auth-aware landing page.
 *
 *  - Logged in        → redirect to /composer (middleware applies plan + onboarding gates from there)
 *  - Logged out       → render the conversion-focused landing page
 *
 * Middleware permits "/" as a public path so the redirect logic happens here, in the
 * page itself, rather than at the edge. Keeping it in the page keeps the auth flow easy
 * to reason about and makes the landing render path identical for every cold visitor.
 */
export default async function RootPage() {
  // Auth check is wrapped so a Supabase outage or missing env never breaks the
  // public landing page. The marketing surface is the most important thing
  // to keep up; we'd rather lose the auth-aware redirect than the page.
  let isAuthed = false
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      isAuthed = !!user
    }
  } catch {
    // fall through and render the landing
  }

  if (isAuthed) {
    redirect("/composer")
  }

  return <LandingPage />
}
