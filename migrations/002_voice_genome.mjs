// migrations/002_voice_genome.mjs
// Run: node --env-file=.env.local migrations/002_voice_genome.mjs

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

console.log("Running migration: 002_voice_genome...")

await sql`
  CREATE TABLE IF NOT EXISTS voice_genome_events (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id        TEXT        NOT NULL,
    generation_id        BIGINT      REFERENCES composer_events(id),
    voice_id             TEXT        NOT NULL,
    variant              TEXT        NOT NULL,
    use_case             TEXT,
    script_length        INTEGER,
    direction_marks_used TEXT[],
    direction_mark_count INTEGER     DEFAULT 0,
    downloaded           BOOLEAN     DEFAULT FALSE,
    regenerated          BOOLEAN     DEFAULT FALSE,
    session_position     INTEGER,
    plan_tier            TEXT,
    emotional_direction  TEXT,
    character_count      INTEGER,
    audio_duration_s     NUMERIC,
    provider             TEXT        DEFAULT 'hume',
    model_id             TEXT,
    metadata             JSONB       DEFAULT '{}',
    created_at           TIMESTAMPTZ DEFAULT NOW()
  )
`
console.log("✓ voice_genome_events")

await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_clerk_user_id ON voice_genome_events(clerk_user_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_voice_id ON voice_genome_events(voice_id)`
await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_variant ON voice_genome_events(variant)`
await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_use_case ON voice_genome_events(use_case)`
await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_downloaded ON voice_genome_events(downloaded)`
await sql`CREATE INDEX IF NOT EXISTS idx_voice_genome_created_at ON voice_genome_events(created_at)`
console.log("✓ indexes")

await sql`
  CREATE OR REPLACE VIEW voice_genome_by_use_case AS
  SELECT
    voice_id,
    variant,
    use_case,
    COUNT(*) AS total_generations,
    COUNT(*) FILTER (WHERE downloaded = TRUE) AS downloads,
    ROUND(COUNT(*) FILTER (WHERE downloaded = TRUE)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1) AS download_rate,
    COUNT(*) FILTER (WHERE regenerated = TRUE) AS regenerations,
    ROUND(AVG(direction_mark_count), 1) AS avg_direction_marks,
    ROUND(AVG(script_length), 0) AS avg_script_length,
    ROUND(AVG(audio_duration_s), 1) AS avg_audio_duration
  FROM voice_genome_events
  WHERE use_case IS NOT NULL
  GROUP BY voice_id, variant, use_case
  ORDER BY total_generations DESC
`
console.log("✓ view: voice_genome_by_use_case")

await sql`
  CREATE OR REPLACE VIEW voice_download_performance AS
  SELECT
    voice_id,
    variant,
    COUNT(*) AS total_generations,
    COUNT(*) FILTER (WHERE downloaded = TRUE) AS downloads,
    ROUND(COUNT(*) FILTER (WHERE downloaded = TRUE)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1) AS download_rate,
    COUNT(*) FILTER (WHERE regenerated = TRUE) AS regenerations,
    ROUND(COUNT(*) FILTER (WHERE regenerated = TRUE)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1) AS regeneration_rate
  FROM voice_genome_events
  GROUP BY voice_id, variant
  ORDER BY download_rate DESC
`
console.log("✓ view: voice_download_performance")

console.log("\nMigration complete.")
