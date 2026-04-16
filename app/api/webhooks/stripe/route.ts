/**
 * app/api/webhooks/stripe/route.ts
 * Handles Stripe webhook events for subscription lifecycle management.
 *
 * Registered events:
 *   checkout.session.completed    — activate paid plan (+ set trial_ends_at if trial)
 *   customer.subscription.deleted — deactivate plan + send cancellation email + cancel scheduled emails
 *   invoice.payment_succeeded     — send subscription confirmed email on first real charge after trial
 *   invoice.payment_failed        — send payment failed email
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY        — from Stripe dashboard
 *   STRIPE_WEBHOOK_SECRET    — from Stripe Dashboard → Webhooks → Signing Secret
 *
 * Setup in Stripe Dashboard:
 *   Webhooks → Add endpoint → https://composer.lyricvoices.ai/api/webhooks/stripe
 *   Subscribe to: checkout.session.completed, customer.subscription.deleted,
 *                 invoice.payment_succeeded, invoice.payment_failed
 *
 * NOTE: You must register invoice.payment_succeeded and invoice.payment_failed
 *       in the Stripe Dashboard webhook settings for these handlers to fire.
 */

import { headers } from "next/headers"
import Stripe from "stripe"
import { neon } from "@neondatabase/serverless"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  sendTrialWelcome,
  scheduleTrialNudge,
  scheduleTrialConversion,
  sendSubscriptionConfirmed,
  sendPaymentFailed,
  sendCancellationConfirmed,
  cancelScheduledEmails,
} from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function db() {
  return neon(process.env.DATABASE_URL!)
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
    const isTrial = session.metadata?.is_trial === "true"

    if (!userId || !planId) {
      console.error("[webhook/stripe] Missing metadata on session:", session.id)
      return Response.json({ received: true })
    }

    // Calculate trial_ends_at if this is a trial checkout
    let trialEndsAt: string | null = null
    if (isTrial) {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 7)
      trialEndsAt = trialEnd.toISOString()
    }

    await activatePlan(userId, planId, trialEndsAt)

    // Send subscription confirmed email for direct (non-trial) checkouts
    if (!isTrial) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (user) {
          const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ""
          const firstName =
            (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
            (user.user_metadata?.name as string | undefined)?.split(" ")[0] ??
            undefined
          if (email) {
            const planName = planId === "studio" ? "Studio" : "Creator"
            await sendSubscriptionConfirmed({ to: email, firstName, planName, amount: planId === "studio" ? "$99" : "$29" })
          }
        }
      } catch (err) {
        console.error("[webhook/stripe] Failed to send subscription confirmed email:", err)
      }
    }

    // Send trial email sequence if this is a trial start
    if (isTrial && trialEndsAt) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (user) {
          const email = user.email ?? (user.user_metadata?.email as string | undefined) ?? ""
          const firstName =
            (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
            (user.user_metadata?.name as string | undefined)?.split(" ")[0] ??
            undefined

          if (email) {
            const emailParams = { to: email, firstName, trialEndsAt: new Date(trialEndsAt) }

            // Send all trial emails and capture scheduled email IDs for later cancellation
            const [, nudgeResult, conversionResult] = await Promise.allSettled([
              sendTrialWelcome(emailParams),
              scheduleTrialNudge(emailParams),
              scheduleTrialConversion(emailParams),
            ])

            // Store scheduled email IDs in app_metadata so we can cancel them if user cancels mid-trial
            const scheduledEmailIds: string[] = []
            if (nudgeResult.status === "fulfilled" && nudgeResult.value.data?.id) {
              scheduledEmailIds.push(nudgeResult.value.data.id)
            }
            if (conversionResult.status === "fulfilled" && conversionResult.value.data?.id) {
              scheduledEmailIds.push(conversionResult.value.data.id)
            }

            if (scheduledEmailIds.length > 0) {
              await supabaseAdmin.auth.admin.updateUserById(userId, {
                app_metadata: { scheduled_email_ids: scheduledEmailIds },
              })
            }
          }
        }
      } catch (err) {
        console.error("[webhook/stripe] Failed to send trial emails:", err)
      }
    }
  }

  // ── invoice.payment_succeeded — send subscription confirmed on first real charge ──
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    const customerId = invoice.customer as string

    // Only send on first real charge after trial (not the $0 trial invoice)
    // subscription_cycle covers natural trial conversion + monthly renewals
    // subscription_create is handled by checkout.session.completed to avoid duplicate sends
    if (invoice.amount_paid > 0 && invoice.billing_reason === "subscription_cycle") {
      try {
        const { email, firstName, userId } = await lookupUserByCustomerId(customerId)
        if (email && userId) {
          // Determine plan name from user profile, amount from invoice
          const { data: { user: freshUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
          const planTier = freshUser?.app_metadata?.plan_tier as string | undefined
          const planName = planTier === "studio" ? "Studio" : "Creator"
          const amount = `$${(invoice.amount_paid / 100).toFixed(0)}`

          await sendSubscriptionConfirmed({ to: email, firstName, planName, amount })

          // Clear scheduled email IDs since the trial has converted,
          // and clear any payment_failed flag from a previous failed attempt
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: { scheduled_email_ids: null, payment_failed: null },
          })
        }
      } catch (err) {
        console.error("[webhook/stripe] Failed to send subscription confirmed email:", err)
      }
    }
  }

  // ── invoice.payment_failed — notify user + flag in app_metadata ───────────
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const customerId = invoice.customer as string

    try {
      const { email, firstName, userId } = await lookupUserByCustomerId(customerId)
      if (email) {
        await sendPaymentFailed({ to: email, firstName })
      }
      // Set payment_failed flag so the composer can show an in-app banner
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: { payment_failed: true },
        })
      }
    } catch (err) {
      console.error("[webhook/stripe] Failed to send payment failed email:", err)
    }
  }

  // ── customer.subscription.deleted — deactivate plan ───────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string

    try {
      const { email, firstName, userId } = await lookupUserByCustomerId(customerId)

      if (userId) {
        await deactivatePlan(userId)

        // Send cancellation confirmation email
        if (email) {
          await sendCancellationConfirmed({ to: email, firstName })
        }

        // Cancel any pending scheduled trial emails
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
          const scheduledEmailIds = (user?.app_metadata?.scheduled_email_ids as string[] | undefined) ?? []
          if (scheduledEmailIds.length > 0) {
            await cancelScheduledEmails(scheduledEmailIds)
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              app_metadata: { scheduled_email_ids: null },
            })
          }
        } catch (cancelErr) {
          console.error("[webhook/stripe] Failed to cancel scheduled emails:", cancelErr)
        }
      }
    } catch (err) {
      console.error("[webhook/stripe] Failed to handle subscription deletion:", err)
    }
  }

  return Response.json({ received: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a user's email, firstName, and userId by their Stripe customer ID. */
async function lookupUserByCustomerId(customerId: string): Promise<{
  email: string | undefined
  firstName: string | undefined
  userId: string | undefined
}> {
  const sql = db()
  const rows = await sql`
    SELECT user_id FROM user_profiles
    WHERE stripe_customer_id = ${customerId}
    LIMIT 1
  `
  const userId = (rows[0] as { user_id: string } | undefined)?.user_id
  if (!userId) return { email: undefined, firstName: undefined, userId: undefined }

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (!user) return { email: undefined, firstName: undefined, userId }

  const email = user.email ?? (user.user_metadata?.email as string | undefined)
  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    (user.user_metadata?.name as string | undefined)?.split(" ")[0] ??
    undefined

  return { email, firstName, userId }
}

async function activatePlan(
  userId: string,
  planId: string,
  trialEndsAt: string | null,
): Promise<void> {
  // Build app_metadata update
  const metadataUpdate: Record<string, unknown> = { plan_tier: planId }
  if (trialEndsAt) {
    metadataUpdate.trial_ends_at = trialEndsAt
  }

  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: metadataUpdate,
    })
  } catch (err) {
    console.error("[webhook/stripe] Failed to update app_metadata:", err)
  }

  try {
    const sql = db()
    if (trialEndsAt) {
      await sql`
        UPDATE user_profiles
        SET plan_tier = ${planId},
            trial_ends_at = ${trialEndsAt}
        WHERE user_id = ${userId}
      `
    } else {
      await sql`
        UPDATE user_profiles
        SET plan_tier = ${planId}
        WHERE user_id = ${userId}
      `
    }
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
