/**
 * app/api/cancel-subscription/route.ts
 * Cancels the authenticated user's Stripe subscription.
 *
 * The actual plan deactivation is handled by the existing
 * customer.subscription.deleted webhook handler — this route
 * just triggers the cancellation in Stripe.
 */

import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"
import Stripe from "stripe"
import { sendCancellationConfirmed } from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function db() {
  return neon(process.env.DATABASE_URL!)
}

export async function POST(): Promise<Response> {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Look up Stripe customer
  const sql = db()
  let stripeCustomerId: string | null = null
  try {
    const rows = await sql`
      SELECT stripe_customer_id FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
    `
    stripeCustomerId = (rows[0] as { stripe_customer_id: string | null })?.stripe_customer_id ?? null
  } catch (err) {
    // DB query failed (column may not exist, or no row) — not fatal for cancellation
    console.error("[cancel] Failed to query user_profiles:", err)
  }

  // If no Stripe customer, nothing to cancel in Stripe — treat as success
  if (!stripeCustomerId) {
    // Send cancellation email (awaited so the serverless function doesn't exit early)
    const email = user.email
    if (email) {
      const firstName = user.user_metadata?.first_name ?? user.user_metadata?.name?.split(" ")[0] ?? undefined
      try {
        await sendCancellationConfirmed({ to: email, firstName })
      } catch (err) {
        console.error("[cancel] Failed to send cancellation email:", err)
      }
    }
    return Response.json({ success: true, type: "trial" })
  }

  // Find active or trialing subscription
  let subscription: Stripe.Subscription | null = null
  try {
    const active = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "active", limit: 1 })
    if (active.data.length > 0) {
      subscription = active.data[0]
    } else {
      const trialing = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "trialing", limit: 1 })
      if (trialing.data.length > 0) {
        subscription = trialing.data[0]
      }
    }
  } catch (err) {
    console.error("[cancel] Failed to list subscriptions:", err)
    return Response.json({ error: "Failed to retrieve subscription" }, { status: 500 })
  }

  if (!subscription) {
    return Response.json({ success: true })
  }

  // Determine if this is a trial or paid subscription
  const wasTrial = subscription.status === "trialing"

  // Cancel immediately
  try {
    await stripe.subscriptions.cancel(subscription.id)
  } catch (err) {
    console.error("[cancel] Failed to cancel subscription:", err)
    return Response.json({ error: "Failed to cancel subscription" }, { status: 500 })
  }

  // Send cancellation email (awaited so the serverless function doesn't exit early)
  const email = user.email
  if (email) {
    const firstName = user.user_metadata?.first_name ?? user.user_metadata?.name?.split(" ")[0] ?? undefined
    try {
      await sendCancellationConfirmed({ to: email, firstName })
    } catch (err) {
      console.error("[cancel] Failed to send cancellation email:", err)
    }
  }

  return Response.json({ success: true, type: wasTrial ? "trial" : "subscription" })
}
