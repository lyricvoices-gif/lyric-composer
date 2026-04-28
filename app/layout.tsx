import type { Metadata } from "next"
import { Geist, Geist_Mono, Cormorant_Garamond, Instrument_Serif } from "next/font/google"
import "./globals.css"
import SessionPing from "@/components/SessionPing"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
})

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Lyric Composer",
  description: "AI voice performance direction",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <SessionPing />
        {children}
      </body>
    </html>
  )
}
