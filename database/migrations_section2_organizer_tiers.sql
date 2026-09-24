-- =============================================================================
-- §2 ORGANIZER TIERS — additive migration
-- =============================================================================
-- Run after migrations_section1_payments.sql (this reads no new tables from
-- it, but §2 as a whole depends on `plans`/`subscriptions` existing).
-- All statements are IF NOT EXISTS-safe to re-run.
-- =============================================================================

-- Branded tournament page (Pro/Org tier): custom banner + accent colors,
-- consumed by the frontend's existing CSS custom-property theming, scoped
-- per-tournament instead of site-wide.
ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS banner_url           TEXT,
    ADD COLUMN IF NOT EXISTS brand_primary_color  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS brand_accent_color   VARCHAR(20);

-- Organizer verification queue (manual admin-approval gate before a
-- Pro/Org-tier organizer's tournament goes public). One row per request;
-- an organizer can re-request after a rejection, so this is a log, not a
-- single status column on `users`.
CREATE TABLE IF NOT EXISTS organizer_verifications (
    verification_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id          INT                 NOT NULL,
    status           VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    note             VARCHAR(255),                                    -- optional admin reason (mainly for rejections)
    requested_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at      DATETIME,
    reviewed_by      INT,
    CONSTRAINT fk_overif_user     FOREIGN KEY (user_id)     REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_overif_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_overif_user   ON organizer_verifications(user_id);
CREATE INDEX idx_overif_status ON organizer_verifications(status);

-- §1 seeded organizer_pro/organizer_org without an explicit "no participant
-- cap" flag — add it now so the free-tier cap enforcement below has
-- something to check against on the plans that should be exempt from it.
UPDATE plans
   SET feature_flags = JSON_SET(feature_flags, '$.unlimited_participants', true)
 WHERE plan_key IN ('organizer_pro', 'organizer_org');

-- NOTE on tournaments.status: the roadmap's organizer-verification gate
-- means an unverified Pro/Org organizer's tournament is created with
-- status = 'pending_review' instead of 'upcoming' (application-level, not
-- a schema constraint — the column already accepts any VARCHAR(20)). The
-- public tournament listing excludes 'pending_review'; organizers see their
-- own via GET /api/tournaments/mine regardless of status.
