/**
 * app/api/webhooks/stripe/route.ts
 * Handles Stripe webhook events for subscription lifecycle management.
 *
 * Registered events:
 *   checkout.session.completed    — activate paid plan
 *   customer.subscription.deleted — deactivate plan on cancellation
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — from Stripe dashboard
 *   STRIPE_WEBHOOK_SECRET    — from Stripe Dashboard → Webhooks → Signing Secret
 *
 * Setup in Stripe Dashboard:
 *   Webhooks → Add endpoint → https://composer.lyricvoices.ai/api/webhooks/stripe
 *   Subscribe to: checkout.session.completed, customer.subscription.deleted
 */

import { headers } from "next/headers"
import Stripe from "stripe"
import { neon } from "@neondatabase/serverless"
import { supabaseAdmin } from "@/lib/supabase/admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function db() {
  return neon(process.env.DATABASE_URL!)
}

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_CREATOR!]: "creator",
  [process.env.STRIPE_PRICE_STUDIO!]:  "studio",
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set")
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const headersList = await headers()
  const sig = headersList.get("stripe-signature")
  if (!sig) return Response.json({ error: "Missing stripe-signature" }, { status: 400 })

  const payload = await req.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret)
  } catch (err) {
    console.error("[webhook/stripe] Signature verification failed:", err)
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  // ── checkout.session.completed — activate plan ────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    const planId = session.metadata?.plan_id

    if (!userId || !planId) {
      console.error("[webhook/stripe] Missing metadata on session:", session.id)
      return Response.json({ received: true })
    }

    await activatePlan(userId, planId)
  }

  // ── customer.subscription.deleted — deactivate plan ───────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string

    try {
      const sql = db()
      const rows = await sql`
        SELECT user_id FROM user_profiles
        WHERE stripe_customer_id = ${customerId}
        LIMIT 1
      `
      const userId = (rows[0] as { user_id: string } | undefined)?.user_id
      if (userId) {
        await deactivatePlan(userId)
      }
    } catch (err) {
      console.error("[webhook/stripe] Failed to deactivate plan:", err)
    }
  }

  return Response.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function activatePlan(userId: string, planId: string): Promise<void> {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { plan_tier: planId },
    })
  } catch (err) {
    console.error("[webhook/stripe] Failed to update app_metadata:", err)
  }

  try {
    const sql = db()
    await sql`
      UPDATE user_profiles
      SET plan_tier = ${planId}
      WHERE user_id = ${userId}
    `
  } catch (err) {
    console.error("[webhook/stripe] Failed to update user_profiles:", err)
  }
}

async function deactivatePlan(userId: string): Promise<void> {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { plan_tier: null },
    })
  } catch (err) {
    console.error("[webhook/stripe] Failed to clear app_metadata plan:", err)
  }

  try {
    const sql = db()
    await sql`
      UPDATE user_profiles
      SET plan_tier = 'expired'
      WHERE user_id = ${userId}
    `
  } catch (err) {
    console.error("[webhook/stripe] Failed to update user_profiles:", err)
  }
}
