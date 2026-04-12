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

const ISOTOPE_SRC = "https://composer.lyricvoices.ai/isotope-dark.svg"

interface SubscriptionConfirmedProps {
  firstName?: string
  planName: string
  amount: string
}

export default function SubscriptionConfirmed({
  firstName,
  planName,
  amount,
}: SubscriptionConfirmedProps) {
  const name = firstName ?? "there"

  return (
    <Html>
      <Head />
      <Preview>Your {planName} plan is now active.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Img src={ISOTOPE_SRC} width="28" height="28" alt="Lyric" style={isotopeLogo} />

          <Hr style={divider} />

          <Section style={content}>
            <Text style={eyebrow}>Subscription active</Text>
            <Text style={heading}>Welcome to Lyric {planName}.</Text>
            <Text style={paragraph}>
              {name}, your {planName} plan is now active. You were charged{" "}
              {amount} today and your subscription renews monthly.
            </Text>
            <Text style={paragraph}>
              You have full access to every voice, every direction mark, and
              every generation included in your plan.
            </Text>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Button href="https://composer.lyricvoices.ai" style={button}>
              Open the composer →
            </Button>
          </Section>

          <Section style={content}>
            <Text style={hint}>
              You can manage your subscription anytime from{" "}
              <a href="https://composer.lyricvoices.ai/account" style={{ color: "#9c958f" }}>
                Manage subscription
              </a>{" "}
              in the composer.
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
