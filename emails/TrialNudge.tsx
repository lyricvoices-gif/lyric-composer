import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

interface TrialNudgeProps {
  firstName?: string
}

export default function TrialNudge({ firstName }: TrialNudgeProps) {
  const name = firstName ?? "there"

  return (
    <Html>
      <Head />
      <Preview>2 days left in your Lyric trial.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Text style={wordmark}>lyric</Text>

          <Hr style={divider} />

          <Section style={content}>
            <Text style={eyebrow}>2 days remaining</Text>
            <Text style={heading}>Still haven&apos;t heard it?</Text>
            <Text style={paragraph}>
              Hey {name} — your Lyric trial ends in 2 days. If you haven&apos;t
              opened the composer yet, now&apos;s the time.
            </Text>
            <Text style={paragraph}>
              Try loading a line of copy you&apos;ve been struggling to make feel
              right — and run it through Morgan or Nova. Direction changes everything.
            </Text>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Button href="https://composer.lyricvoices.ai" style={button}>
              Open the composer →
            </Button>
          </Section>

          <Section style={content}>
            <Text style={hint}>
              Your trial converts to Creator ($29/mo) in 2 days. No action needed
              if you&apos;d like to continue. Cancel anytime in account settings.
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

const wordmark: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 400,
  letterSpacing: "-0.01em",
  color: DARK,
  margin: "0 0 24px",
}

const divider: React.CSSProperties = {
  borderColor: "#e5dfd5",
  margin: "0 0 28px",
}

const content: React.CSSProperties = {
  marginBottom: "28px",
}

const eyebrow: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: GOLD,
  margin: "0 0 10px",
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
