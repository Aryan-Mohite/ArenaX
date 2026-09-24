-- =============================================================================
-- §1 PAYMENTS INFRASTRUCTURE — additive migration
-- =============================================================================
-- Run this against your existing database (phpMyAdmin > SQL tab, or
-- `mysql -u ... -p arenax < database/migrations_section1_payments.sql`).
-- Every statement uses IF NOT EXISTS, so it's safe to run more than once
-- and won't touch any existing table.
--
-- These three tables are the foundation every paid feature in the roadmap
-- plugs into: organizer tiers (§2), college licenses (§3), premium gamer
-- membership (§4) all just add rows to `plans` and point `subscriptions` at
-- a `user_id` (or, once §3 lands, an `org_id` — that column is reserved now
-- so we don't need another migration later).
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
    plan_id       INT AUTO_INCREMENT  PRIMARY KEY,
    plan_key      VARCHAR(50)         UNIQUE NOT NULL,  -- e.g. 'organizer_pro', 'organizer_org', 'gamer_pro'
    name          VARCHAR(100)        NOT NULL,
    description   VARCHAR(255),
    price         DECIMAL(10,2)       NOT NULL DEFAULT 0,
    currency      VARCHAR(10)         NOT NULL DEFAULT 'INR',
    billing_cycle VARCHAR(20)         NOT NULL DEFAULT 'monthly',  -- monthly | annual
    feature_flags JSON                NOT NULL,                    -- { "branded_page": true, "analytics": true, ... }
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id         INT AUTO_INCREMENT  PRIMARY KEY,
    user_id                 INT,                       -- individual gamer/organizer subscriber
    org_id                  INT,                        -- reserved for §3 college/org billing; unused until then
    plan_id                 INT                 NOT NULL,
    status                  VARCHAR(20)         NOT NULL DEFAULT 'active',  -- active | past_due | canceled | expired
    started_at              DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    renews_at               DATETIME,
    canceled_at             DATETIME,
    gateway                 VARCHAR(20),                -- razorpay | cashfree
    gateway_customer_id     VARCHAR(100),
    gateway_subscription_id VARCHAR(100),
    created_at              DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS payments (
    payment_id      INT AUTO_INCREMENT  PRIMARY KEY,
    subscription_id INT,
    user_id         INT                 NOT NULL,
    plan_id         INT                 NOT NULL,   -- which plan this order was for — lets the webhook
                                                       -- activate a subscription on its own, without
                                                       -- depending on the checkout-flow callback having run
    gateway         VARCHAR(20)         NOT NULL,   -- razorpay | cashfree
    gateway_order_id   VARCHAR(150),                 -- order id created before payment
    gateway_payment_id VARCHAR(150),                 -- id once payment succeeds
    amount          DECIMAL(10,2)       NOT NULL,
    currency        VARCHAR(10)         NOT NULL DEFAULT 'INR',
    status          VARCHAR(20)         NOT NULL DEFAULT 'created',  -- created | success | failed | refunded
    raw_payload     JSON,                             -- last webhook payload received, for support/debugging
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_sub  FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_pay_plan FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
    UNIQUE KEY uq_payments_gateway_order (gateway, gateway_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payments_status  ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- ─── Starter plans ──────────────────────────────────────────────────────────
-- Free tiers aren't billed but still need a plan row so `hasFeature` has
-- something to compare against; paid tiers use realistic placeholder
-- pricing — adjust before going live with real payments.
INSERT IGNORE INTO plans (plan_key, name, description, price, billing_cycle, feature_flags) VALUES
    ('organizer_free', 'Organizer — Free',      'Basic tournament listing, capped participants.', 0,    'monthly', JSON_OBJECT('branded_page', false, 'analytics', false, 'announcements', false)),
    ('organizer_pro',  'Organizer — Pro',       'Branded tournament page, automated announcements, analytics.', 499, 'monthly', JSON_OBJECT('branded_page', true, 'analytics', true, 'announcements', true)),
    ('organizer_org',  'Organizer — Organization', 'Multi-tournament dashboard, org branding, read-only API.', 1999, 'monthly', JSON_OBJECT('branded_page', true, 'analytics', true, 'announcements', true, 'multi_tournament_dashboard', true, 'api_access', true)),
    ('gamer_pro',      'ArenaX Pro',            'Verified badge, advanced stats, priority Team Finder placement.', 99, 'monthly', JSON_OBJECT('verified_badge', true, 'advanced_stats', true, 'priority_placement', true));



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
