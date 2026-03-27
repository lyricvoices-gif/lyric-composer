-- ============================================================================
-- Lyric Composer — Schema updates for Supabase Auth migration
-- Run this in your Neon database (SQL Editor or psql)
-- ============================================================================

-- 1. user_profiles
--    Rename clerk_user_id → user_id (Supabase UUID)
--    Add onboarding fields + stripe_customer_id

ALTER TABLE user_profiles
  RENAME COLUMN clerk_user_id TO user_id;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete  BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_voice     TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_variant   TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_intent    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT;

-- Drop old constraint (if it referenced clerk_user_id by name) and recreate
-- Adjust constraint name below to match your actual constraint name
-- ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_clerk_user_id_key;
-- ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);

-- 2. voice_genome_events
--    Rename clerk_user_id → user_id

ALTER TABLE voice_genome_events
  RENAME COLUMN clerk_user_id TO user_id;

-- 3. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;
