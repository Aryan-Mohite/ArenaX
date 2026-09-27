-- =============================================================================
-- §6 ANALYTICS & EVENTS LAYER — additive migration
-- =============================================================================
-- Independent of §3/§7. Safe to re-run — plain CREATE TABLE IF NOT EXISTS,
-- no FK-bearing ALTERs this time so no information_schema guard needed.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section6_analytics.sql
-- =============================================================================

-- ─── events ──────────────────────────────────────────────────────────────────
-- One row per meaningful action: signup, login, tournament_registration,
-- team_created, community_post (see eventService.EVENT_TYPES — the single
-- source of truth for which strings are valid). user_id is nullable so a
-- logging bug or a future anonymous event type can never violate the FK and
-- take the request down with it.
CREATE TABLE IF NOT EXISTS events (
    event_id    BIGINT AUTO_INCREMENT  PRIMARY KEY,
    user_id     INT,
    event_type  VARCHAR(50)            NOT NULL,
    metadata    JSON,
    created_at  DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powers DAU/WAU/MAU and retention cohort queries (event_type + time window).
CREATE INDEX idx_events_type_created ON events(event_type, created_at);
-- Powers "did this specific user log in on day X" retention joins.
CREATE INDEX idx_events_user_type_created ON events(user_id, event_type, created_at);

-- ─── analytics_daily_rollup ──────────────────────────────────────────────────
-- One row per calendar day, populated by the nightly cron job
-- (src/jobs/analyticsRollupJob.js). This exists purely so the "signups/
-- logins/registrations per day over the last N days" trend chart doesn't
-- have to re-scan the full (and ever-growing) `events` table on every
-- dashboard load. DAU/WAU/MAU and retention still query `events` directly —
-- those need a DISTINCT user count, which can't be derived by summing daily
-- rollup rows without double-counting repeat visitors.
CREATE TABLE IF NOT EXISTS analytics_daily_rollup (
    rollup_date               DATE      PRIMARY KEY,
    signups                   INT       NOT NULL DEFAULT 0,
    logins                    INT       NOT NULL DEFAULT 0,   -- distinct users, i.e. that day's DAU
    tournament_registrations  INT       NOT NULL DEFAULT 0,
    teams_created             INT       NOT NULL DEFAULT 0,
    community_posts           INT       NOT NULL DEFAULT 0,
    computed_at               DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
