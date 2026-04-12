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
    console.error("[cancel] Failed to query user_profiles:", err)
    return Response.json({ error: "Database error" }, { status: 500 })
  }

  if (!stripeCustomerId) {
    return Response.json({ error: "No billing account found" }, { status: 400 })
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
    return Response.json({ error: "No active subscription found" }, { status: 404 })
  }

  // Cancel immediately
  try {
    await stripe.subscriptions.cancel(subscription.id)
  } catch (err) {
    console.error("[cancel] Failed to cancel subscription:", err)
    return Response.json({ error: "Failed to cancel subscription" }, { status: 500 })
  }

  return Response.json({ success: true })
}
