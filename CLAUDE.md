# Lyric Composer — Claude Instructions

## Project Overview

Next.js 16 app (App Router) that lets users compose AI-generated lyric voice-overs.
Auth via Clerk, database via Neon (PostgreSQL), payments via Stripe.

## Stack

- **Framework**: Next.js 16 with App Router
- **Auth**: Clerk (`@clerk/nextjs`)
- **Database**: Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **Payments**: Stripe
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## Project Structure

```
app/
  api/
    generate/route.ts       # Proxy to Cloudflare voice worker
    compositions/route.ts   # CRUD for saved compositions
    analytics/
      track/route.ts        # Event tracking
      dashboard/route.ts    # Analytics dashboard
  composer/page.tsx         # Main composer UI
  upgrade/page.tsx          # Upgrade/pricing page
lib/
  voiceData.ts              # Voice definitions
  planConfig.ts             # Plan tiers and limits
  analytics.ts              # Client-side analytics helpers
middleware.ts               # Clerk auth middleware
```

## Database Tables

- `generation_usage (user_id, date, count)` — daily generation tracking
- `compositions (id, user_id, voice_id, variant, script, directions, audio_url, duration_s, title, created_at)`
- `composer_events (...)` — analytics events

## Key Environment Variables

- `DATABASE_URL` — Neon connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe

## Development

```bash
npm run dev    # Start dev server on :3000
npm run build  # Production build
npm run lint   # ESLint
```

## Conventions

- All API routes use `app/api/*/route.ts` with named exports (`GET`, `POST`, etc.)
- Auth check with `const { userId } = await auth()` from `@clerk/nextjs/server`
- DB access via `neon(process.env.DATABASE_URL)` — use tagged template literals for queries
- Return `Response.json(...)` for JSON responses
- Voice generation proxies through `https://lyric-voice-api.sparknfable.workers.dev`

## Remote Control

Tag `@claude` in any GitHub issue or PR comment to trigger this Claude Code agent.
The agent will read the issue/comment context and make the requested code changes.
