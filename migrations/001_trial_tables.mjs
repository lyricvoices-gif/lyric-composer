// migrations/001_trial_tables.mjs
// Run: node --env-file=.env.local migrations/001_trial_tables.mjs

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

console.log("Running migration: 001_trial_tables...")

await sql`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id    TEXT        UNIQUE NOT NULL,
    email            TEXT,
    onboarding_intent  TEXT,
    onboarding_voice   TEXT,
    onboarding_variant TEXT,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at    TIMESTAMPTZ,
    trial_converted  BOOLEAN     DEFAULT FALSE,
    trial_cancelled  BOOLEAN     DEFAULT FALSE,
    plan_tier        TEXT        DEFAULT 'trial',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
  )
`
console.log("✓ user_profiles")

await sql`
  CREATE TABLE IF NOT EXISTS trial_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id  TEXT        NOT NULL,
    event_type     TEXT        NOT NULL,
    voice_id       TEXT,
    variant        TEXT,
    session_id     TEXT,
    trial_day      INTEGER,
    metadata       JSONB       DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )
`
console.log("✓ trial_events")

await sql`CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_user_id ON user_profiles(clerk_user_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_trial_events_clerk_user_id ON trial_events(clerk_user_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_trial_events_event_type ON trial_events(event_type)`
await sql`CREATE INDEX IF NOT EXISTS idx_trial_events_trial_day ON trial_events(trial_day)`
console.log("✓ indexes")

await sql`
  CREATE OR REPLACE VIEW trial_funnel AS
  SELECT
    COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL) AS total_trials,
    COUNT(*) FILTER (WHERE trial_converted = TRUE) AS converted,
    COUNT(*) FILTER (WHERE trial_cancelled = TRUE) AS cancelled,
    COUNT(*) FILTER (WHERE trial_ends_at < NOW() AND trial_converted = FALSE AND trial_cancelled = FALSE) AS expired,
    ROUND(COUNT(*) FILTER (WHERE trial_converted = TRUE)::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE trial_started_at IS NOT NULL), 0) * 100, 1) AS conversion_rate
  FROM user_profiles
`
console.log("✓ view: trial_funnel")

await sql`
  CREATE OR REPLACE VIEW intent_breakdown AS
  SELECT
    onboarding_intent,
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE trial_converted = TRUE) AS converted,
    ROUND(COUNT(*) FILTER (WHERE trial_converted = TRUE)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
  FROM user_profiles
  WHERE onboarding_intent IS NOT NULL
  GROUP BY onboarding_intent
  ORDER BY total_users DESC
`
console.log("✓ view: intent_breakdown")

await sql`
  CREATE OR REPLACE VIEW voice_affinity AS
  SELECT
    onboarding_voice,
    onboarding_variant,
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE trial_converted = TRUE) AS converted,
    ROUND(COUNT(*) FILTER (WHERE trial_converted = TRUE)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
  FROM user_profiles
  WHERE onboarding_voice IS NOT NULL
  GROUP BY onboarding_voice, onboarding_variant
  ORDER BY total_users DESC
`
console.log("✓ view: voice_affinity")

console.log("\nMigration complete.")
