/**
 * app/api/auth/send-email/route.ts
 *
 * Supabase Auth Email Hook — intercepts all auth-related emails
 * (signup confirmation, magic link, OTP) and sends branded versions
 * via Resend instead of Supabase's default unbranded emails.
 *
 * Supabase HTTPS hooks use Standard Webhooks (Svix) signature
 * verification — HMAC-SHA256 with headers: webhook-id, webhook-timestamp,
 * webhook-signature.
 *
 * Setup in Supabase Dashboard:
 *   Authentication → Auth Hooks → Add Send Email hook
 *   → HTTPS → POST https://composer.lyricvoices.ai/api/auth/send-email
 *   → Paste the generated secret (v1,whsec_... format)
 *
 * Required env vars:
 *   SUPABASE_AUTH_HOOK_SECRET  — the full v1,whsec_... secret from Supabase
 *   RESEND_API_KEY             — from Resend dashboard
 *   EMAIL_FROM                 — verified sender, e.g. "Lyric <noreply@lyricvoices.ai>"
 */

import crypto from "crypto"
import { Resend } from "resend"
import { render } from "@react-email/components"
import OtpCode from "@/emails/OtpCode"

// ── Helpers ──────────────────────────────────────────────────────────────────

function resend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not set")
  return new Resend(key)
}

function from() {
  return process.env.EMAIL_FROM ?? "Lyric <noreply@lyricvoices.ai>"
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Verify the Standard Webhooks signature from Supabase.
 * See: https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
function verifyWebhookSignature(
  body: string,
  headers: Headers
): boolean {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) throw new Error("SUPABASE_AUTH_HOOK_SECRET is not set")

  const webhookId = headers.get("webhook-id")
  const webhookTimestamp = headers.get("webhook-timestamp")
  const webhookSignature = headers.get("webhook-signature")

  if (!webhookId || !webhookTimestamp || !webhookSignature) return false

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(webhookTimestamp, 10)
  if (isNaN(ts) || Math.abs(now - ts) > 300) return false

  // Strip "v1,whsec_" prefix to get the raw base64 secret
  const base64Secret = secret.replace(/^v1,whsec_/, "")
  const secretBytes = Buffer.from(base64Secret, "base64")

  // Construct signed content and compute HMAC-SHA256
  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64")

  // The header may contain multiple signatures (v1,<sig1> v1,<sig2>)
  // Check if any match
  const signatures = webhookSignature.split(" ")
  for (const sig of signatures) {
    const sigValue = sig.replace(/^v1,/, "")
    try {
      if (timingSafeEqual(expectedSignature, sigValue)) return true
    } catch {
      // Length mismatch — continue to next
    }
  }

  return false
}

// ── Payload types ────────────────────────────────────────────────────────────

interface AuthEmailHookPayload {
  user: {
    id: string
    email: string
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Read body as text first (needed for signature verification)
  const body = await req.text()

  // ── Verify webhook signature ─────────────────────────────────────────────
  try {
    if (!verifyWebhookSignature(body, req.headers)) {
      console.error("[auth/send-email] Invalid webhook signature")
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  } catch (err) {
    console.error("[auth/send-email] Signature verification error:", err)
    return Response.json({ error: "Hook secret not configured" }, { status: 500 })
  }

  // ── Parse payload ────────────────────────────────────────────────────────
  let payload: AuthEmailHookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { user, email_data } = payload
  const { token, email_action_type } = email_data

  if (!user?.email || !token) {
    console.error("[auth/send-email] Missing user email or token in payload")
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  // ── Render branded OTP email and send via Resend ─────────────────────────
  try {
    const subjectMap: Record<string, string> = {
      signup: "Your Lyric verification code",
      magiclink: "Your Lyric sign-in code",
      recovery: "Reset your Lyric password",
      email_change: "Confirm your new email",
      invite: "You've been invited to Lyric",
    }

    const subject = subjectMap[email_action_type] ?? "Your Lyric verification code"
    const html = await render(OtpCode({ otpCode: token }))

    await resend().emails.send({
      from: from(),
      to: user.email,
      subject,
      html,
    })

    console.log(`[auth/send-email] Sent ${email_action_type} email to ${user.email}`)
  } catch (err) {
    console.error("[auth/send-email] Failed to send email:", err)
    return Response.json({ error: "Failed to send email" }, { status: 500 })
  }

  return Response.json({})
}
