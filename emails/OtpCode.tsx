import {
  Body,
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

interface OtpCodeProps {
  otpCode: string
}

export default function OtpCode({ otpCode }: OtpCodeProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Lyric verification code: {otpCode}</Preview>
      <Body style={body}>
        <Container style={container}>

          <Img src={ISOTOPE_SRC} width="48" height="48" alt="Lyric" style={isotopeLogo} />

          <Hr style={divider} />

          <Section style={content}>
            <Text style={heading}>Your verification code</Text>
            <Text style={paragraph}>
              Enter this code in the composer to continue:
            </Text>
          </Section>

          <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
            <Text style={codeBlock}>{otpCode}</Text>
          </Section>

          <Section style={content}>
            <Text style={hint}>
              This code expires in 10 minutes. If you didn&apos;t request this,
              you can safely ignore this email.
            </Text>
          </Section>

          <Hr style={divider} />

          <Text style={footer}>
            Lyric Voices, Inc. &middot; info@lyricvoices.ai
          </Text>

        </Container>
      </Body>
    </Html>
  )
}

// -- Styles -------------------------------------------------------------------

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

const codeBlock: React.CSSProperties = {
  fontSize: "36px",
  fontWeight: 700,
  letterSpacing: "0.25em",
  color: DARK,
  backgroundColor: LIGHT,
  border: `1px solid #e5dfd5`,
  borderRadius: "10px",
  padding: "16px 24px",
  display: "inline-block",
  margin: 0,
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
