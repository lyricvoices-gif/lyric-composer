import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

const ISOTOPE_SRC = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path fill="#2b2a25" d="m8,16c0,4.42,3.58,8,8,8h8v-4h-8c-2.21,0-4-1.79-4-4v-4h-4v4Z"/><polygon fill="#2b2a25" points="24 16 24 8 12 8 12 12 20 12 20 16 24 16"/></svg>').toString('base64')}`

interface TrialWelcomeProps {
  firstName?: string
  trialEndsAt: string // ISO date string, formatted before passing in
}

export default function TrialWelcome({ firstName, trialEndsAt }: TrialWelcomeProps) {
  const name = firstName ?? "there"

  return (
    <Html>
      <Head />
      <Preview>Your 7-day Lyric trial has started.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Img src={ISOTOPE_SRC} width="28" height="28" alt="Lyric" style={isotopeLogo} />

          <Hr style={divider} />

          <Section style={content}>
            <Text style={heading}>Your trial is live.</Text>
            <Text style={paragraph}>
              Hey {name} — welcome to Lyric. You have 7 days to explore the composer
              and hear what intentional voice direction actually sounds like.
            </Text>
            <Text style={paragraph}>
              Five voices. Three tonal variants each. Direction presets that shape
              how each line performs — not just what it says.
            </Text>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Button href="https://composer.lyricvoices.ai" style={button}>
              Enter the composer →
            </Button>
          </Section>

          <Section style={content}>
            <Text style={hint}>
              Your trial ends on {trialEndsAt}. After that, you'll be automatically
              moved to the Creator plan ($29/mo). Cancel anytime before then from
              your account settings.
            </Text>
          </Section>

          <Hr style={divider} />

          <Text style={footer}>
            Lyric Voices, Inc. · info@lyricvoices.ai
          </Text>

        </Container>
      </Body>
    </Html>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const DARK  = "#2b2a25"
const GOLD  = "#c9a96e"
const LIGHT = "#f5f3ef"
const MUTED = "#9c958f"

const body: React.CSSProperties = {
  backgroundColor: LIGHT,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin: 0,
  padding: "40px 0",
}

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5dfd5",
  borderRadius: "12px",
  maxWidth: "520px",
  margin: "0 auto",
  padding: "40px",
}

const isotopeLogo: React.CSSProperties = {
  margin: "0 0 24px",
}

const divider: React.CSSProperties = {
  borderColor: "#e5dfd5",
  margin: "0 0 28px",
}

const content: React.CSSProperties = {
  marginBottom: "28px",
}

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: DARK,
  margin: "0 0 16px",
  lineHeight: "1.2",
}

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  color: "#4a4a45",
  lineHeight: "1.6",
  margin: "0 0 14px",
}

const button: React.CSSProperties = {
  backgroundColor: DARK,
  borderRadius: "100px",
  color: LIGHT,
  fontSize: "14px",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  padding: "12px 28px",
  textDecoration: "none",
  display: "inline-block",
}

const hint: React.CSSProperties = {
  fontSize: "12px",
  color: MUTED,
  lineHeight: "1.6",
  margin: 0,
  borderLeft: `3px solid ${GOLD}`,
  paddingLeft: "12px",
}

const footer: React.CSSProperties = {
  fontSize: "11px",
  color: MUTED,
  textAlign: "center" as const,
  margin: "20px 0 0",
}
