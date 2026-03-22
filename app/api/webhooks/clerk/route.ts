/**
 * app/api/webhooks/clerk/route.ts
 * Handles Clerk webhook events for trial lifecycle management.
 *
 * Registered events:
 *   user.created — set trial_ends_at metadata, schedule all 3 trial emails
 *
 * Required env vars:
 *   CLERK_WEBHOOK_SECRET  — from Clerk Dashboard → Webhooks → Signing Secret
 *   RESEND_API_KEY        — from Resend dashboard
 *   EMAIL_FROM            — verified sender address
 *
 * Setup in Clerk Dashboard:
 *   Webhooks → Add endpoint → https://composer.lyricvoices.ai/api/webhooks/clerk
 *   Subscribe to: user.created
 */

import { Webhook } from "svix"
import { headers } from "next/headers"
import { clerkClient } from "@clerk/nextjs/server"
import type { UserMetadata } from "@/lib/planConfig"
import {
  sendTrialWelcome,
  scheduleTrialNudge,
  scheduleTrialConversion,
} from "@/lib/email"

// ---------------------------------------------------------------------------
// Types (minimal — only the fields we use)
// ---------------------------------------------------------------------------

interface ClerkUserCreatedEvent {
  type: "user.created"
  data: {
    id: string
    email_addresses: Array<{ email_address: string; id: string }>
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
  }
}

type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown }

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error("[webhook/clerk] CLERK_WEBHOOK_SECRET is not set")
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  // ── Verify Svix signature ─────────────────────────────────────────────────
  const headersList = await headers()
  const svixId        = headersList.get("svix-id")
  const svixTimestamp = headersList.get("svix-timestamp")
  const svixSignature = headersList.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(secret)

  let event: ClerkWebhookEvent
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  // ── Handle user.created ───────────────────────────────────────────────────
  if (event.type === "user.created") {
    const user = (event as ClerkUserCreatedEvent).data

    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id
    )
    const email = primaryEmail?.email_address
    if (!email) {
      console.error("[webhook/clerk] user.created: no primary email for", user.id)
      return Response.json({ error: "No primary email" }, { status: 400 })
    }

    const firstName = user.first_name ?? undefined

    // ── Set trial_ends_at on Clerk publicMetadata ─────────────────────────
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    try {
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: {
          trial_ends_at: trialEndsAt.toISOString(),
        } satisfies Partial<UserMetadata>,
      })
    } catch (err) {
      console.error("[webhook/clerk] Failed to set trial_ends_at:", err)
      // Non-fatal — continue to send emails
    }

    // ── Schedule all 3 trial emails ───────────────────────────────────────
    // Fire-and-forget: log failures but don't block the 200 response
    const emailParams = { to: email, firstName, trialEndsAt }

    Promise.allSettled([
      sendTrialWelcome(emailParams),
      scheduleTrialNudge(emailParams),
      scheduleTrialConversion(emailParams),
    ]).then((results) => {
      results.forEach((r, i) => {
        const label = ["welcome", "nudge", "conversion"][i]
        if (r.status === "rejected") {
          console.error(`[webhook/clerk] Failed to send/schedule ${label} email:`, r.reason)
        }
      })
    })
  }

  return Response.json({ received: true })
}
