import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

const ISOTOPE_SRC = "https://composer.lyricvoices.ai/isotope-dark.svg"

interface TrialConversionProps {
  firstName?: string
}

export default function TrialConversion({ firstName }: TrialConversionProps) {
  const name = firstName ?? "there"

  return (
    <Html>
      <Head />
      <Preview>Your Lyric trial ends tomorrow.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Img src={ISOTOPE_SRC} width="28" height="28" alt="Lyric" style={isotopeLogo} />

          <Hr style={divider} />

          <Section style={content}>
            <Text style={eyebrow}>Trial ends tomorrow</Text>
            <Text style={heading}>
              Your trial converts to Creator tomorrow.
            </Text>
            <Text style={paragraph}>
              {name}, your Lyric trial converts to the Creator plan ($29/mo)
              tomorrow. No action needed to continue. To cancel before your
              trial ends, visit{" "}
              <a href="https://composer.lyricvoices.ai/account" style={{ color: "#4a4a45" }}>
                Manage subscription
              </a>{" "}
              in the composer.
            </Text>
          </Section>

          {/* What you keep */}
          <Section style={planBox}>
            <Text style={planLabel}>Creator plan includes</Text>
            <Row>
              <Column>
                {[
                  "All 5 Edition 01 voices",
                  "25 generations per day",
                  "3 variants per voice",
                  "Inline direction marks",
                  "MP3 download",
                ].map((f) => (
                  <Text key={f} style={featureItem}>✓ {f}</Text>
                ))}
              </Column>
            </Row>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
            <Button href="https://composer.lyricvoices.ai" style={button}>
              Continue with Lyric →
            </Button>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "28px" }}>
            <Text style={cancelLink}>
              Need to cancel?{" "}
              <a href="https://composer.lyricvoices.ai/account" style={{ color: "#9c958f" }}>
                Manage subscription
              </a>{" "}
              before tomorrow.
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

const planBox: React.CSSProperties = {
  backgroundColor: "#faf9f7",
  border: "1px solid #e5dfd5",
  borderRadius: "10px",
  padding: "20px 24px",
  marginBottom: "28px",
}

const planLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: MUTED,
  margin: "0 0 12px",
}

const featureItem: React.CSSProperties = {
  fontSize: "13px",
  color: "#4a4a45",
  margin: "0 0 6px",
  lineHeight: "1.4",
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

const cancelLink: React.CSSProperties = {
  fontSize: "12px",
  color: MUTED,
  margin: 0,
}

const footer: React.CSSProperties = {
  fontSize: "11px",
  color: MUTED,
  textAlign: "center" as const,
  margin: "20px 0 0",
}
