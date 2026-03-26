# Lyric Composer — CLAUDE.md

## What This Is
The **paid composer app** for Lyric — an AI SaaS platform for voice performance direction.
Users direct AI voices with emotional intent, inline marks, and variant selection, then generate MP3 audio via the Cloudflare voice worker.

**GitHub:** `github.com/lyricvoices-gif/lyric-composer` (private)
**Production:** `https://composer.lyricvoices.com` (Vercel, auto-deploys from `main`)
**Dev:** `npm run dev` → `http://localhost:3000`

---

## Architecture at a Glance

```
User (Clerk auth) → Next.js App → /api/generate → Cloudflare Worker → Hume.AI Octave TTS
                                                                    ↓
                                                              MP3 streamed back
                                              ↓
                              Neon DB (usage tracking, voice genome events)
                              Clerk (user metadata, plan, trial)
                              Resend (trial email sequences)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js App Router (TypeScript, "use client" where needed) |
| Auth | Clerk (publicMetadata for plan + trial + onboarding state) |
| Database | Neon (serverless Postgres, `@neondatabase/serverless`) |
| Voice AI | Hume.AI Octave TTS via Cloudflare Worker proxy |
| Email | Resend + React Email (`@react-email/components`) |
| Payments | Stripe via Clerk Billing (native integration — no custom webhooks) |
| Hosting | Vercel |
| Storage | Cloudflare R2 (voice sample audio + voice metadata) |

---

## Plan IDs & Limits

Defined in `lib/planConfig.ts`. Read from Clerk `publicMetadata.plan`.

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
  layout.tsx                    — ClerkProvider, signUpForceRedirectUrl="/onboarding", signInFallbackRedirectUrl="/composer"
  page.tsx                      — Root redirect (→ /composer)
  composer/page.tsx             — Main composer (~900 lines, "use client")
  onboarding/
    page.tsx                    — Server component: checks onboarding_complete, redirects to /composer if done
    OnboardingFlow.tsx          — 3-step client flow: intent → voice → variant
  sign-up/[[...sign-up]]/page.tsx  — Clerk SignUp component (catch-all)
  sign-in/[[...sign-in]]/page.tsx  — Clerk SignIn component (catch-all)
  upgrade/page.tsx              — (exists but likely superseded — see NoPlanWall below)

  api/
    generate/route.ts           — Authenticated proxy to Cloudflare worker + voice genome tracking
    analytics/
      track/route.ts            — Tracks generation/download/preview events to Neon
      dashboard/route.ts        — Aggregates data for lyric-analytics dashboard
    compositions/route.ts       — CRUD for saved compositions
    onboarding/route.ts         — Writes onboarding metadata to Clerk
    webhooks/clerk/route.ts     — Handles user.created: sets trial_ends_at, writes user_profiles, schedules emails

lib/
  planConfig.ts                 — Plan definitions, resolvePlanId(), hasComposerAccess(), trial helpers
  voiceData.ts                  — Canonical voice definitions (IDs, variants, intents, sample URLs)
  analytics.ts                  — Client-side trackGeneration/trackDownload/trackPreview helpers
  email.ts                      — Resend email send helpers

migrations/
  001_trial_tables.mjs          — Creates: user_profiles, trial_events; views: trial_funnel, intent_breakdown, voice_affinity
  002_voice_genome.mjs          — Creates: voice_genome_events table + voice_genome_by_use_case + voice_download_performance views
```

---

## Neon Database Schema

**Tables (live in production):**
- `composer_events` — every generation/download/preview event (bigint PK)
- `generation_usage` — daily per-user usage counter (user_id + date PK)
- `user_profiles` — one row per user (clerk_user_id PK, email, trial dates, plan_tier)
- `trial_events` — funnel events (trial_started, converted, cancelled, expired)
- `voice_genome_events` — rich per-generation behavioral data (UUID PK, FK to composer_events.id as BIGINT)

**Views (live):**
- `trial_funnel` — aggregated conversion stats
- `intent_breakdown` — conversion by onboarding intent
- `voice_affinity` — conversion by onboarding voice
- `voice_genome_by_use_case` — genome stats grouped by voice + use case
- `voice_download_performance` — download + regeneration rates by voice/variant

---

## Cloudflare Worker

**URL:** `https://lyric-voice-api.sparknfable.workers.dev` (LIVE IN PRODUCTION — do not break)
- The Next.js app proxies through `/api/generate` (adds auth + usage tracking)
- Worker handles Hume.AI API calls directly
- Returns MP3 blob (not a URL)
- Worker payload shape is documented in memory/voice-data-canonical.md

---

## Auth & Access Flow

1. Unauthenticated user hits `/composer` → Clerk redirects to `/sign-in`
2. New sign-up → forced to `/onboarding`
3. Onboarding complete → `/composer`
4. On composer load: `hasPaidPlan(has)` checked
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

On complete: writes to Clerk `publicMetadata`:
```ts
{ onboarding_complete: true, onboarding_voice, onboarding_variant, onboarding_intent }
```

---

## Trial System

- 7-day trial, credit card required at signup (configured in Clerk Dashboard)
- Auto-charges to Creator at day 7
- `trial_ends_at` set in Clerk `publicMetadata` by `webhooks/clerk/route.ts` on `user.created`
- Email sequence (via Resend): Welcome (day 0), Nudge (day 5), Conversion (day 7)
- Trial users get Creator-level limits via `hasComposerAccess(has, trialEndsAt)`

---

## Voice Genome Tracking

On every generation, `api/generate/route.ts`:
1. Pre-generates `genomeEventId = crypto.randomUUID()`
2. Sets `X-Genome-Event-Id` response header
3. Calls `writeGenomeEvent()` non-blocking (no await on response)

`writeGenomeEvent()` inserts to `voice_genome_events`:
- voice_id, variant, user_id, use_case (from Clerk onboarding_intent)
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
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
CLERK_WEBHOOK_SECRET

# Neon
DATABASE_URL

# Cloudflare Worker
CLOUDFLARE_WORKER_URL=https://lyric-voice-api.sparknfable.workers.dev

# Resend
RESEND_API_KEY
EMAIL_FROM

# Analytics (internal)
ANALYTICS_SECRET
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
