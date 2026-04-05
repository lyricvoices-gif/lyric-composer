// app/api/analytics/dashboard/route.ts
// Serves all data needed by the analytics dashboard in a single request.
// Pulls from Neon (composer events, user_profiles) and Stripe (revenue).

import { createClient } from "@/lib/supabase/server"
import { neon } from "@neondatabase/serverless"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-02-25.clover",
  })
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

const ADMIN_USER_IDS = (process.env.ANALYTICS_ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Allow server-to-server access via Bearer token (analytics dashboard app)
  const analyticsSecret = process.env.ANALYTICS_SECRET
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "")
  const hasValidBearer = analyticsSecret && bearer === analyticsSecret

  if (!hasValidBearer) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !ADMIN_USER_IDS.includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const { searchParams } = new URL(req.url)
  const range = parseInt(searchParams.get("range") ?? "30", 10)
  const since = daysAgo(range)

  try {
    const sql = getDb()
    const [
      overviewRows,
      voiceRows,
      variantRows,
      emotionRows,
      planRows,
      dailyRows,
      latencyRows,
      userData,
      stripeData,
      trialData,
      genomeData,
    ] = await Promise.all([
      // ── Overview totals ──────────────────────────────────────────────────
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'generation')  AS total_generations,
          COUNT(*) FILTER (WHERE event_type = 'download')    AS total_downloads,
          COUNT(*) FILTER (WHERE event_type = 'preview')     AS total_previews,
          COUNT(DISTINCT user_id)                            AS unique_users,
          ROUND(SUM(audio_duration_s)::NUMERIC, 0)           AS total_audio_seconds,
          ROUND(SUM(character_count)::NUMERIC, 0)            AS total_characters
        FROM composer_events
        WHERE created_at >= ${since.toISOString()}
      `,

      // ── Generations by voice ─────────────────────────────────────────────
      sql`
        SELECT
          voice_id,
          COUNT(*) FILTER (WHERE event_type = 'generation')  AS generations,
          COUNT(*) FILTER (WHERE event_type = 'download')    AS downloads,
          COUNT(DISTINCT user_id)                            AS unique_users,
          ROUND(AVG(audio_duration_s)::NUMERIC, 2)           AS avg_audio_s
        FROM composer_events
        WHERE created_at >= ${since.toISOString()}
        GROUP BY voice_id
        ORDER BY generations DESC
      `,

      // ── Generations by variant ───────────────────────────────────────────
      sql`
        SELECT
          voice_id,
          voice_variant,
          COUNT(*) AS generations
        FROM composer_events
        WHERE
          event_type = 'generation'
          AND voice_variant IS NOT NULL
          AND created_at >= ${since.toISOString()}
        GROUP BY voice_id, voice_variant
        ORDER BY generations DESC
      `,

      // ── Emotional directions ─────────────────────────────────────────────
      sql`
        SELECT
          emotional_direction,
          COUNT(*)                   AS uses,
          COUNT(DISTINCT user_id)    AS unique_users,
          ROUND(
            COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1
          ) AS pct
        FROM composer_events
        WHERE
          event_type = 'generation'
          AND emotional_direction IS NOT NULL
          AND created_at >= ${since.toISOString()}
        GROUP BY emotional_direction
        ORDER BY uses DESC
        LIMIT 20
      `,

      // ── Breakdown by plan tier ───────────────────────────────────────────
      sql`
        SELECT
          COALESCE(plan_tier, 'unknown') AS plan_tier,
          COUNT(*) FILTER (WHERE event_type = 'generation') AS generations,
          COUNT(*) FILTER (WHERE event_type = 'download')   AS downloads,
          COUNT(DISTINCT user_id)                           AS unique_users
        FROM composer_events
        WHERE created_at >= ${since.toISOString()}
        GROUP BY plan_tier
        ORDER BY generations DESC
      `,

      // ── Daily generation trend ───────────────────────────────────────────
      sql`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) FILTER (WHERE event_type = 'generation') AS generations,
          COUNT(*) FILTER (WHERE event_type = 'download')   AS downloads,
          COUNT(DISTINCT user_id)                           AS unique_users
        FROM composer_events
        WHERE created_at >= ${since.toISOString()}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // ── Generation latency percentiles ───────────────────────────────────
      sql`
        SELECT
          ROUND(AVG(duration_ms)::NUMERIC, 0)                                                    AS avg_ms,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0)            AS p50_ms,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0)           AS p95_ms
        FROM composer_events
        WHERE
          event_type = 'generation'
          AND duration_ms IS NOT NULL
          AND created_at >= ${since.toISOString()}
      `,

      // ── User growth & plan breakdown from user_profiles ──────────────────
      fetchUserData(),

      // ── Stripe: MRR, subscriptions, recent events ────────────────────────
      fetchStripeData(),

      // ── Trial funnel, intent breakdown, voice affinity ───────────────────
      fetchTrialData(),

      // ── Voice genome: download/regen performance, use case breakdown ──────
      fetchGenomeData(),
    ])

    return NextResponse.json({
      range_days: range,
      generated_at: new Date().toISOString(),
      overview: overviewRows[0] ?? {},
      voices: voiceRows,
      variants: variantRows,
      emotional_directions: emotionRows,
      plan_breakdown: planRows,
      daily_trend: dailyRows,
      latency: latencyRows[0] ?? {},
      users: userData,
      stripe: stripeData,
      trial: trialData,
      genome: genomeData,
    })
  } catch (err) {
    console.error("[analytics/dashboard] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── User data fetcher (from user_profiles) ───────────────────────────────────

async function fetchUserData() {
  try {
    const sql = getDb()
    const thirtyDaysAgo = daysAgo(30).toISOString()

    const [totalRows, newRows, planRows] = await Promise.all([
      sql`SELECT COUNT(*) AS total FROM user_profiles`,
      sql`SELECT COUNT(*) AS count FROM user_profiles WHERE trial_started_at >= ${thirtyDaysAgo}`,
      sql`
        SELECT
          COALESCE(plan_tier, 'trial') AS plan_tier,
          COUNT(*) AS count
        FROM user_profiles
        GROUP BY plan_tier
        ORDER BY count DESC
      `,
    ])

    const planDistribution: Record<string, number> = {}
    for (const row of planRows as { plan_tier: string; count: string }[]) {
      planDistribution[row.plan_tier] = Number(row.count)
    }

    return {
      total_users: Number((totalRows[0] as { total: string }).total),
      new_users_last_30d: Number((newRows[0] as { count: string }).count),
      plan_distribution: planDistribution,
    }
  } catch (err) {
    console.error("[analytics/dashboard] User data fetch failed:", err)
    return { error: "User data unavailable" }
  }
}

// ─── Trial data fetcher ───────────────────────────────────────────────────────

async function fetchTrialData() {
  try {
    const sql = getDb()
    const [funnelRows, intentRows, affinityRows] = await Promise.all([
      sql`SELECT * FROM trial_funnel`,
      sql`SELECT * FROM intent_breakdown`,
      sql`SELECT * FROM voice_affinity`,
    ])
    return {
      funnel: funnelRows[0] ?? null,
      intent_breakdown: intentRows,
      voice_affinity: affinityRows,
    }
  } catch (err) {
    console.error("[analytics/dashboard] Trial data fetch failed:", err)
    return { error: "Trial data unavailable" }
  }
}

// ─── Stripe data fetcher ──────────────────────────────────────────────────────

async function fetchStripeData() {
  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.items.data.price"],
    })

    let mrr = 0
    const planCounts: Record<string, number> = {}

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const price = item.price
        const amount = price.unit_amount ?? 0
        const interval = price.recurring?.interval

        const planName = price.nickname ?? price.id

        planCounts[planName] = (planCounts[planName] ?? 0) + 1

        if (interval === "month") {
          mrr += amount / 100
        } else if (interval === "year") {
          mrr += amount / 100 / 12
        }
      }
    }

    const charges = await stripe.charges.list({
      limit: 100,
      created: { gte: Math.floor(daysAgo(30).getTime() / 1000) },
    })

    const revenueLastMonth = charges.data
      .filter((c) => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount / 100, 0)

    const events = await stripe.events.list({
      limit: 20,
      types: [
        "customer.subscription.created",
        "customer.subscription.deleted",
        "customer.subscription.updated",
      ],
    })

    const recentEvents = events.data.map((e) => ({
      type: e.type,
      created: new Date(e.created * 1000).toISOString(),
    }))

    return {
      mrr: Math.round(mrr * 100) / 100,
      active_subscriptions: subscriptions.data.length,
      revenue_last_30d: Math.round(revenueLastMonth * 100) / 100,
      plan_counts: planCounts,
      recent_events: recentEvents,
    }
  } catch (err) {
    console.error("[analytics/dashboard] Stripe fetch failed:", err)
    return { error: "Stripe data unavailable" }
  }
}

// ─── Voice genome data fetcher ────────────────────────────────────────────────

async function fetchGenomeData() {
  try {
    const sql = getDb()
    const [downloadPerf, useCaseRows] = await Promise.all([
      sql`SELECT * FROM voice_download_performance`,
      sql`SELECT * FROM voice_genome_by_use_case`,
    ])
    return {
      download_performance: downloadPerf,
      use_case_breakdown: useCaseRows,
    }
  } catch (err) {
    console.error("[analytics/dashboard] Genome fetch failed:", err)
    return { error: "Genome data unavailable" }
  }
}
