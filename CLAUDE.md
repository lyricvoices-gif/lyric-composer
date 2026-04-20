# Lyric Composer — CLAUDE.md

## What This Is
The **paid composer app** for Lyric — an AI SaaS platform for voice performance direction.
Users direct AI voices with emotional intent, inline marks, and variant selection, then generate MP3 audio via the Cloudflare voice worker.

**GitHub:** `github.com/lyricvoices-gif/lyric-composer` (private)
**Production:** `https://composer.lyricvoices.ai` (Vercel, auto-deploys from `main`)
**Dev:** `npm run dev` → `http://localhost:3000`

---

## Architecture at a Glance

```
User (Supabase auth) → Next.js App → /api/generate → Cloudflare Worker → Hume.AI Octave TTS
                                                                       ↓
                                                                 MP3 streamed back
                                                 ↓
                                 Neon DB (usage tracking, voice genome events, events funnel)
                                 Supabase (auth, user app_metadata: plan, trial, onboarding)
                                 Stripe (billing, subscriptions, webhooks)
                                 Resend (trial email sequences + admin alerts)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js App Router (TypeScript, "use client" where needed) |
| Auth | Supabase Auth (user `app_metadata` for plan + trial + onboarding state) |
| Database | Neon (serverless Postgres, `@neondatabase/serverless`) |
| Voice AI | Hume.AI Octave TTS via Cloudflare Worker proxy |
| Email | Resend + React Email (`@react-email/components`) |
| Payments | Stripe Checkout + webhooks (see `app/api/webhooks/stripe/route.ts`) |
| Hosting | Vercel |
| Storage | Cloudflare R2 (voice sample audio + voice metadata) |

---

## Plan IDs & Limits

Defined in `lib/planConfig.ts`. Read from Supabase user `app_metadata.plan_tier`.

| Plan | Daily Gens | Max Script | Stripe ID |
|---|---|---|---|
| `creator` | 25 | 500 chars | lowest paid tier |
| `studio` | 100 | 2,000 chars | mid tier |
| `enterprise` | unlimited | 10,000 chars | top tier |

No free tier in this app. Free experience = mini composer on the marketing site.
Trial users (`trial_ends_at` set, no plan yet) get Creator-level limits.

---

## Key Files

```
app/
  layout.tsx                    — Root layout + SessionPing (DAU tracker)
  page.tsx                      — Root redirect (→ /composer)
  composer/page.tsx             — Main composer (~900 lines, "use client")
  onboarding/
    page.tsx                    — Server component: checks onboarding_complete, redirects to /composer if done
    OnboardingFlow.tsx          — 5-step client flow (welcome → demo → use case → voice → variant)
  sign-up/[[...sign-up]]/page.tsx  — Supabase sign-up (catch-all)
  sign-in/[[...sign-in]]/page.tsx  — Supabase sign-in (catch-all)
  upgrade/page.tsx              — (exists but likely superseded — see NoPlanWall below)

  api/
    generate/route.ts           — Authenticated proxy to Cloudflare worker + voice genome tracking + error alerts
    analytics/
      track/route.ts            — Tracks generation/download/preview events to Neon
      dashboard/route.ts        — Aggregates data for lyric-analytics dashboard
    compositions/route.ts       — CRUD for saved compositions
    onboarding/route.ts         — Writes onboarding metadata to Supabase + tracks step events
    session/start/route.ts      — Records session_started event (DAU/WAU/MAU)
    checkout/route.ts           — Creates Stripe Checkout session + logs checkout_started
    webhooks/stripe/route.ts    — Handles Stripe events: trial conversion, cancellation, payment failures, admin alerts
    provision-user/route.ts     — Creates user_profiles row on first composer load

lib/
  planConfig.ts                 — Plan definitions, resolvePlanId(), hasComposerAccess(), trial helpers
  voiceData.ts                  — Canonical voice definitions (IDs, variants, intents, sample URLs)
  analytics.ts                  — Client-side trackGeneration/trackDownload/trackPreview helpers
  email.ts                      — Resend email send helpers

migrations/
  001_trial_tables.mjs          — Creates: user_profiles, trial_events; views: trial_funnel, intent_breakdown, voice_affinity
  002_voice_genome.mjs          — Creates: voice_genome_events table + voice_genome_by_use_case + voice_download_performance views
  003_observability.mjs         — Drops legacy trial_events; creates user_events + views: generation_error_stats, checkout_funnel, active_users_stats, active_users_daily, onboarding_funnel

scripts/
  schema-updates.sql            — Historical: renamed clerk_user_id → user_id (one-time migration from Clerk to Supabase)
```

---

## Neon Database Schema

**Tables (live in production):**
- `composer_events` — every generation/download/preview event (bigint PK)
- `generation_usage` — daily per-user usage counter (user_id + date PK)
- `user_profiles` — one row per user (user_id PK = Supabase UUID, email, trial dates, plan_tier, trial_converted, trial_cancelled)
- `user_events` — product funnel + observability events (session_started, checkout_started, checkout_completed, onboarding_step, onboarding_completed, generation_error, payment_failed, subscription_cancelled)
- `voice_genome_events` — rich per-generation behavioral data (UUID PK)

**Views (live):**
- `trial_funnel` — aggregated conversion stats (reads trial_converted/trial_cancelled columns set by Stripe webhook)
- `intent_breakdown` — conversion by onboarding intent
- `voice_affinity` — conversion by onboarding voice
- `voice_genome_by_use_case` — genome stats grouped by voice + use case
- `voice_download_performance` — download + regeneration rates by voice/variant
- `generation_error_stats` — daily error counts with stage breakdown
- `checkout_funnel` — checkout_started vs checkout_completed with completion rate (last 30d)
- `active_users_stats` — DAU / WAU / MAU from session_started events
- `active_users_daily` — daily active users trend (last 30d)
- `onboarding_funnel` — first-time onboarding step-by-step drop-off (last 90d, excludes revisits)

---

## Cloudflare Worker

**URL:** `https://lyric-voice-api.sparknfable.workers.dev` (LIVE IN PRODUCTION — do not break)
- The Next.js app proxies through `/api/generate` (adds auth + usage tracking)
- Worker handles Hume.AI API calls directly
- Returns MP3 blob (not a URL)
- Worker payload shape is documented in memory/voice-data-canonical.md

---

## Auth & Access Flow

1. Unauthenticated user hits `/composer` → middleware redirects to `/sign-in`
2. New sign-up → forced to `/onboarding` (via middleware check of `onboarding_complete` in Supabase `app_metadata`)
3. Onboarding complete → `/composer`
4. On composer load: plan check via `app_metadata.plan_tier` + `trial_ends_at`
   - No paid plan + no active trial → `NoPlanWall` fires `window.location.replace(MARKETING_URL + "/pricing")`
   - Has plan or active trial → composer renders with plan limits applied

```ts
const MARKETING_URL = "https://lyric-marketing.vercel.app"
```

**Update this constant when lyricvoices.ai goes live.**

---

## Onboarding Flow (3 steps)

Step 1 — **Intent:** User picks a creative intent (e.g. "Calm & measured", "Bold & assertive")
Step 2 — **Voice:** User picks a voice from the 5 available
Step 3 — **Variant:** User picks a variant for that voice (e.g. "Anchor", "Grounded")

On complete: writes to Supabase user `app_metadata` (and mirrors key fields to `user_profiles`):
```ts
{ onboarding_complete: true, onboarding_voice, onboarding_variant, onboarding_intent }
```

Each step advance and the final completion write a row to `user_events` for funnel analytics.
First-time completions are distinguished from revisits (via `?revisit=1` query param) server-side.

---

## Trial System

- 7-day trial, credit card captured at Stripe Checkout via `subscription_data: { trial_period_days: 7 }`
- Stripe auto-charges at day 7; `invoice.payment_succeeded` webhook sends the `SubscriptionConfirmed` email and flips `trial_converted = TRUE`
- `trial_ends_at` set in Supabase `app_metadata` (and `user_profiles`) by the Stripe webhook on `checkout.session.completed` (when `is_trial = true`)
- Email sequence (via Resend, all scheduled at signup): Welcome (day 0), Nudge (day 5), Conversion (day 6)
- Trial users get Creator-level limits via `hasComposerAccess(trialEndsAt)`

---

## Voice Genome Tracking

On every generation, `api/generate/route.ts`:
1. Pre-generates `genomeEventId = crypto.randomUUID()`
2. Sets `X-Genome-Event-Id` response header
3. Calls `writeGenomeEvent()` non-blocking (no await on response)

`writeGenomeEvent()` inserts to `voice_genome_events`:
- voice_id, variant, user_id, use_case (from Supabase `app_metadata.onboarding_intent`)
- direction_marks (extracted emotion values from segments)
- session_position (count of today's genome events + 1)
- regenerated (same voice+variant in last 60s = true)

On download: `api/analytics/track` receives `genomeEventId` and sets `downloaded = TRUE`.

---

## Voice IDs (Canonical)

Always use the full hyphenated ID format:

| Display Name | Voice ID |
|---|---|
| Morgan · The Anchor | `morgan-anchor` |
| Nova · The Intimist | `nova-intimist` |
| Atlas · The Guide | `atlas-guide` |
| Riven · The Narrator | `riven-narrator` |
| Hex · The Wildcard | `hex-wildcard` |

---

## Environment Variables (Required)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Neon
DATABASE_URL

# Cloudflare Worker
CLOUDFLARE_WORKER_URL=https://lyric-voice-api.sparknfable.workers.dev

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_CREATOR
STRIPE_PRICE_STUDIO
NEXT_PUBLIC_APP_URL=https://composer.lyricvoices.ai

# Resend
RESEND_API_KEY
EMAIL_FROM
ALERT_TO=thelyricvoices@gmail.com

# Analytics (internal)
ANALYTICS_SECRET
ANALYTICS_ADMIN_USER_IDS   # comma-separated Supabase user IDs allowed to view dashboard via browser
```

---

## Known Issues / TODOs

- `app/upgrade/page.tsx` — likely unused now that `NoPlanWall` redirects to `/pricing` directly. Confirm and delete if so.
- `MARKETING_URL` constant in `composer/page.tsx` is hardcoded to `https://lyric-marketing.vercel.app`. Update to `https://lyricvoices.ai` when domain goes live.
- `planConfig.ts` comment still references "Framer mini composer" — update to marketing site.
- Composer page (`composer/page.tsx`) is ~900 lines with DOM manipulation in a giant useEffect. Planned refactor into component-based architecture (see memory/target-structure.md).
- Voice audio stubs: only Morgan has real R2 audio. Others use synthetic tone stubs until Hume is fully wired.
- Voice data in `lib/voiceData.ts` vs mini composer — reconcile if voice IDs drift.

---

## Deploy

```bash
vercel --prod
```
Vercel auto-deploys on push to `main`. Build is standard Next.js.
