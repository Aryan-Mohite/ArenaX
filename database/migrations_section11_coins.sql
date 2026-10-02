-- =============================================================================
-- 11 SPECIAL COINS  additive migration
-- =============================================================================
-- Earn-only loyalty currency: coins are awarded for achievements, spent on
-- rewards (Pro days, gift cards, in-game top-ups). Never purchasable and never
-- transferable between users.
--
-- The exchange rate (`coins_per_inr`) and every earn amount live in
-- `coin_settings` so an admin can retune the economy without a deploy.
--
-- Safe to re-run: CREATE IF NOT EXISTS + INSERT IGNORE throughout.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section11_coins.sql
-- =============================================================================

--  coin_settings 
-- Key/value pairs, all stored as text; coinService parses and validates them.
CREATE TABLE IF NOT EXISTS coin_settings (
    setting_key   VARCHAR(60)   PRIMARY KEY,
    setting_value VARCHAR(100)  NOT NULL,
    updated_by    INT           NULL,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_coin_settings_user FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO coin_settings (setting_key, setting_value) VALUES
    ('coins_per_inr',                 '100'),   -- 100 coins = 1 rupee of reward value
    ('earn_login',                    '5'),
    ('earn_dailies',                  '10'),
    ('earn_profile_complete',         '25'),
    ('earn_first_game',               '25'),
    ('earn_team_join',                '50'),
    ('earn_streak_7',                 '50'),
    ('earn_streak_30',                '250'),
    ('pro_multiplier',                '2'),
    ('pro_multiplier_reasons',        'login,dailies'),
    ('pro_bonus_monthly_cap',         '600'),   -- max EXTRA coins a Pro user can earn from the multiplier per month
    ('team_join_vest_days',           '7'),     -- team-join coins stay pending until the user is still a member after this long
    ('redeem_min_account_age_days',   '7'),
    ('max_cash_redemptions_per_month','2'),     -- gift cards / top-ups per user per month
    ('redemptions_enabled',           '1');     -- master kill switch

--  coin_settings_audit 
CREATE TABLE IF NOT EXISTS coin_settings_audit (
    audit_id    INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(60)  NOT NULL,
    old_value   VARCHAR(100),
    new_value   VARCHAR(100) NOT NULL,
    changed_by  INT          NULL,
    changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_coin_audit_user FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_coin_audit_changed ON coin_settings_audit(changed_at);

--  coin_ledger 
-- Append-only. Balance = SUM(delta) over status = 'available'.
-- UNIQUE (user_id, ref_key) is the idempotency guard: a retry, double-click or
-- two racing requests can never award the same thing twice.
CREATE TABLE IF NOT EXISTS coin_ledger (
    entry_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT          NOT NULL,
    delta        INT          NOT NULL,                       -- positive = earned, negative = spent
    reason       VARCHAR(40)  NOT NULL,                       -- login | dailies | profile_complete | first_game | team_join | streak_7 | streak_30 | redemption | redemption_refund | admin_adjust
    ref_key      VARCHAR(80)  NOT NULL,                       -- e.g. 'login:2026-10-02', 'first_game', 'redeem:42'
    base_amount  INT          NULL,                           -- amount before any Pro multiplier (earn rows only)
    status       VARCHAR(12)  NOT NULL DEFAULT 'available',   -- pending | available | reversed
    available_at DATETIME     NULL,                           -- when a pending row may vest
    note         VARCHAR(255) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_coin_ledger_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_coin_ledger_ref (user_id, ref_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_coin_ledger_user_status ON coin_ledger(user_id, status);
CREATE INDEX idx_coin_ledger_created     ON coin_ledger(created_at);

--  reward_catalog 
-- type:
--   pro_days  auto-fulfilled: grants ArenaX Pro for `pro_days` days. Costs no cash, so
--              it has a fixed coin cost (`coin_cost`).
--   gift_card / topup  manual fulfilment by an admin. Priced in rupees (`inr_value`);
--              coin cost = ceil(inr_value * coins_per_inr), so changing the exchange
--              rate reprices these automatically.
--   other     manual fulfilment, fixed coin cost.
CREATE TABLE IF NOT EXISTS reward_catalog (
    reward_id   INT AUTO_INCREMENT PRIMARY KEY,
    reward_key  VARCHAR(60)   UNIQUE NOT NULL,
    name        VARCHAR(120)  NOT NULL,
    description VARCHAR(255)  NULL,
    type        VARCHAR(20)   NOT NULL,                       -- pro_days | gift_card | topup | other
    inr_value   DECIMAL(8,2)  NULL,                           -- gift_card / topup only
    coin_cost   INT           NULL,                           -- pro_days / other only
    pro_days    INT           NULL,                           -- pro_days only
    stock       INT           NULL,                           -- NULL = unlimited
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO reward_catalog (reward_key, name, description, type, inr_value, coin_cost, pro_days, sort_order) VALUES
    ('pro_3d',       'ArenaX Pro — 3 days',  'Verified badge, advanced stats, priority Team Finder placement, 2x coins.', 'pro_days', NULL, 1500, 3, 10),
    ('pro_7d',       'ArenaX Pro — 7 days',  'A full week of ArenaX Pro.',                                                'pro_days', NULL, 3000, 7, 20),
    ('gplay_10',     'Google Play ₹10',    'Google Play gift card code, emailed to you.',                               'gift_card', 10,   NULL, NULL, 30),
    ('gplay_50',     'Google Play ₹50',    'Google Play gift card code, emailed to you.',                               'gift_card', 50,   NULL, NULL, 40),
    ('gplay_100',    'Google Play ₹100',   'Google Play gift card code, emailed to you.',                               'gift_card', 100,  NULL, NULL, 50);

--  redemptions 
-- requested  approved  fulfilled, or requested/approved  rejected (coins refunded).
-- pro_days redemptions skip straight to fulfilled.
CREATE TABLE IF NOT EXISTS redemptions (
    redemption_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT           NOT NULL,
    reward_id     INT           NOT NULL,
    coins_spent   INT           NOT NULL,
    inr_value     DECIMAL(8,2)  NULL,                          -- snapshot of the reward's rupee value at redemption time
    status        VARCHAR(12)   NOT NULL DEFAULT 'requested',  -- requested | approved | fulfilled | rejected
    fulfillment   TEXT          NULL,                          -- gift card code / top-up reference, entered by an admin
    admin_note    VARCHAR(255)  NULL,
    reviewed_by   INT           NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_redemption_user   FOREIGN KEY (user_id)     REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_redemption_reward FOREIGN KEY (reward_id)   REFERENCES reward_catalog(reward_id),
    CONSTRAINT fk_redemption_admin  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_redemptions_status ON redemptions(status);
CREATE INDEX idx_redemptions_user   ON redemptions(user_id, created_at);

--  ArenaX Pro: coin multiplier flag 
-- Same JSON_SET pattern 4 used to add profile_banner.
UPDATE plans
   SET feature_flags = JSON_SET(feature_flags, '$.coin_multiplier', true)
 WHERE plan_key = 'gamer_pro'
   AND JSON_EXTRACT(feature_flags, '$.coin_multiplier') IS NULL;
