/**
 * app/api/checkout/route.ts
 * Creates a Stripe Checkout session for a given plan.
 *
 * Supports two modes:
 *   - Trial start:  { planId: "creator", trial: true }  → 7-day free trial, card captured
 *   - Direct sub:   { planId: "studio" }                → immediate charge
 *
 * Period is monthly by default. Pass period: "annual" to use the yearly
 * price IDs (set up to be ~20% cheaper than 12× monthly on the landing
 * page billing toggle).
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY                 — from Stripe dashboard
 *   STRIPE_PRICE_CREATOR              — Stripe price ID for Creator monthly ($29/mo)
 *   STRIPE_PRICE_STUDIO               — Stripe price ID for Studio monthly ($99/mo)
 *   STRIPE_PRICE_CREATOR_ANNUAL       — Stripe price ID for Creator annual ($278/yr)
 *   STRIPE_PRICE_STUDIO_ANNUAL        — Stripe price ID for Studio annual ($950/yr)
 *   NEXT_PUBLIC_APP_URL               — e.g. https://composer.lyricvoices.ai
 */

import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"
import Stripe from "stripe"
import { insertUserEvent } from "@/lib/events"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

type BillingPeriod = "monthly" | "annual"

// plan + period → Stripe price ID. Annual entries fall back to monthly if
// the annual env var isn't set, so adding annual prices in Stripe and then
// shipping the env var change is safe to do in either order.
const PRICE_IDS: Record<string, Record<BillingPeriod, string | undefined>> = {
  creator: {
    monthly: process.env.STRIPE_PRICE_CREATOR,
    annual:  process.env.STRIPE_PRICE_CREATOR_ANNUAL ?? process.env.STRIPE_PRICE_CREATOR,
  },
  studio: {
    monthly: process.env.STRIPE_PRICE_STUDIO,
    annual:  process.env.STRIPE_PRICE_STUDIO_ANNUAL ?? process.env.STRIPE_PRICE_STUDIO,
  },
}

function resolvePriceId(planId: string, period: BillingPeriod): string | null {
  const entry = PRICE_IDS[planId]
  if (!entry) return null
  return entry[period] ?? entry.monthly ?? null
}

function db() {
  return neon(process.env.DATABASE_URL!)
}

export async function POST(req: Request): Promise<Response> {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let body: { planId: string; trial?: boolean; period?: BillingPeriod }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const period: BillingPeriod = body.period === "annual" ? "annual" : "monthly"
  const priceId = resolvePriceId(body.planId, period)
  if (!priceId) {
    return Response.json(
      { error: `No price configured for plan "${body.planId}" period "${period}"` },
      { status: 400 }
    )
  }

  const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ""
  const phone = user.phone ?? (user.user_metadata?.phone as string | undefined) ?? ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://composer.lyricvoices.ai"

  // Retrieve or create Stripe customer so subscriptions are linked to one customer record
  const sql = db()
  let stripeCustomerId: string | null = null

  try {
    const rows = await sql`
      SELECT stripe_customer_id FROM user_profiles WHERE user_id = ${user.id} LIMIT 1
    `
    stripeCustomerId = (rows[0] as { stripe_customer_id: string | null })?.stripe_customer_id ?? null
  } catch {
    // Non-fatal — will create a new customer below
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: email || undefined,
      phone: phone || undefined,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id

    // Persist for future checkouts
    try {
      await sql`
        UPDATE user_profiles
        SET stripe_customer_id = ${stripeCustomerId}
        WHERE user_id = ${user.id}
      `
    } catch (err) {
      console.error("[checkout] Failed to save stripe_customer_id:", err)
    }
  } else {
    // Sync current email to existing Stripe customer
    try {
      await stripe.customers.update(stripeCustomerId, {
        email: email || undefined,
      })
    } catch (err) {
      console.error("[checkout] Failed to sync email to Stripe customer:", err)
    }
  }

  // Build the checkout session
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/composer?checkout=success`,
    cancel_url:  `${appUrl}/upgrade`,
    metadata: {
      supabase_user_id: user.id,
      plan_id: body.planId,
      period,
      is_trial: body.trial ? "true" : "false",
    },
  }

  // Add 7-day trial if requested
  if (body.trial) {
    sessionParams.subscription_data = {
      trial_period_days: 7,
      metadata: {
        supabase_user_id: user.id,
        plan_id: body.planId,
        period,
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  insertUserEvent({
    userId: user.id,
    eventType: "checkout_started",
    planTier: body.planId,
    metadata: {
      is_trial: !!body.trial,
      period,
      session_id: session.id,
      price_id: priceId,
    },
  })

  return Response.json({ url: session.url })
}
