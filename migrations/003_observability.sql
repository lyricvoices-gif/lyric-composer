-- migrations/003_observability.sql
-- Pasteable SQL version of migration 003 for running in Neon's SQL editor.
-- Safe to run more than once (all IF NOT EXISTS / OR REPLACE except the drops).

-- ── Drop legacy trial_events (never written to) ─────────────────────────────
DROP VIEW IF EXISTS trial_funnel_events;
DROP TABLE IF EXISTS trial_events;

-- ── Main events table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_events (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID,
  event_type   TEXT        NOT NULL,
  plan_tier    TEXT,
  metadata     JSONB       DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id    ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);

-- ── Error rate view ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW generation_error_stats AS
SELECT
  DATE(e.created_at)                                                 AS date,
  COUNT(*)                                                           AS errors,
  COUNT(*) FILTER (WHERE e.metadata->>'stage' = 'worker_fetch')      AS worker_fetch_errors,
  COUNT(*) FILTER (WHERE e.metadata->>'stage' = 'worker_status')     AS worker_status_errors
FROM user_events e
WHERE e.event_type = 'generation_error'
GROUP BY DATE(e.created_at)
ORDER BY date DESC;

-- ── Checkout funnel view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW checkout_funnel AS
SELECT
  COUNT(*) FILTER (WHERE event_type = 'checkout_started')   AS started,
  COUNT(*) FILTER (WHERE event_type = 'checkout_completed') AS completed,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'checkout_completed')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'checkout_started'), 0) * 100,
    1
  ) AS completion_rate
FROM user_events
WHERE created_at >= NOW() - INTERVAL '30 days';

-- ── Active users view (DAU / WAU / MAU) ─────────────────────────────────────
CREATE OR REPLACE VIEW active_users_stats AS
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')   AS dau,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS wau,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
FROM user_events
WHERE event_type = 'session_started';

-- ── Daily active users trend ────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_users_daily AS
SELECT
  DATE(created_at)             AS date,
  COUNT(DISTINCT user_id)      AS active_users
FROM user_events
WHERE event_type = 'session_started'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date ASC;

-- ── Onboarding funnel view (first-time users only) ──────────────────────────
CREATE OR REPLACE VIEW onboarding_funnel AS
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_step' AND metadata->>'step' = '1') AS step_1,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_step' AND metadata->>'step' = '2') AS step_2,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_step' AND metadata->>'step' = '3') AS step_3,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_step' AND metadata->>'step' = '4') AS step_4,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_step' AND metadata->>'step' = '5') AS step_5,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'onboarding_completed')                       AS completed
FROM user_events
WHERE (metadata->>'is_revisit' IS NULL OR metadata->>'is_revisit' = 'false')
  AND created_at >= NOW() - INTERVAL '90 days';
