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

interface CancellationConfirmedProps {
  firstName?: string
}

export default function CancellationConfirmed({ firstName }: CancellationConfirmedProps) {
  const name = firstName ?? "there"

  return (
    <Html>
      <Head />
      <Preview>Your subscription has ended.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Img src={ISOTOPE_SRC} width="28" height="28" alt="Lyric" style={isotopeLogo} />

          <Hr style={divider} />

          <Section style={content}>
            <Text style={heading}>Your subscription has ended.</Text>
            <Text style={paragraph}>
              Hey {name}, your Lyric subscription has been cancelled. You won&apos;t
              be charged going forward.
            </Text>
            <Text style={paragraph}>
              Your voice compositions and account remain saved. If you ever want to
              come back, you can resubscribe from the composer at any time.
            </Text>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Button href="https://composer.lyricvoices.ai/upgrade" style={button}>
              Resubscribe →
            </Button>
          </Section>

          <Section style={content}>
            <Text style={hint}>
              Questions? Reach out at info@lyricvoices.ai. We&apos;re here.
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
