-- =============================================================================
-- Final coins batch (safe to re-run)
--   * redemption_disputes      users can report a missing / invalid gift card code
--   * user_streaks.streak_freeze_used_on + gamer_pro 'streak_freeze' flag (Pro perk)
--   * team_finder_boosts + reward_catalog.boost_hours + a free "Team Finder boost" reward
--   * coin settings: monthly_cash_budget_inr, coin_expiry_days, streak_freeze_cooldown_days
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_final_batch.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS redemption_disputes (
    dispute_id    INT AUTO_INCREMENT PRIMARY KEY,
    redemption_id INT          NOT NULL,
    user_id       INT          NOT NULL,
    reason        TEXT         NOT NULL,
    status        VARCHAR(12)  NOT NULL DEFAULT 'open',   -- open | replaced | refunded | denied
    admin_note    VARCHAR(255) DEFAULT NULL,
    resolved_by   INT          DEFAULT NULL,
    resolved_at   DATETIME     DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rd_redemption  FOREIGN KEY (redemption_id) REFERENCES redemptions(redemption_id) ON DELETE CASCADE,
    CONSTRAINT fk_rd_user        FOREIGN KEY (user_id)       REFERENCES users(user_id)             ON DELETE CASCADE,
    CONSTRAINT fk_rd_resolved_by FOREIGN KEY (resolved_by)   REFERENCES users(user_id)             ON DELETE SET NULL,
    INDEX idx_rd_status (status),
    INDEX idx_rd_redemption (redemption_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Streak freeze: the date a Pro user's freeze last saved a streak (cooldown tracking).
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_streaks' AND COLUMN_NAME = 'streak_freeze_used_on');
SET @s := IF(@c = 0, 'ALTER TABLE user_streaks ADD COLUMN streak_freeze_used_on DATE NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE plans SET feature_flags = JSON_SET(feature_flags, '$.streak_freeze', true) WHERE plan_key = 'gamer_pro';

-- Team Finder boost: a free coin sink (costs no cash) that gives a post priority placement for a while.
CREATE TABLE IF NOT EXISTS team_finder_boosts (
    user_id    INT      NOT NULL PRIMARY KEY,
    ends_at    DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tfb_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reward_catalog' AND COLUMN_NAME = 'boost_hours');
SET @s := IF(@c = 0, 'ALTER TABLE reward_catalog ADD COLUMN boost_hours INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

INSERT IGNORE INTO reward_catalog (reward_key, name, description, type, coin_cost, boost_hours, sort_order)
VALUES ('tf_boost_24h', 'Team Finder boost (24 hours)',
        'Your Team Finder posts are shown first for 24 hours.', 'tf_boost', 300, 24, 5);

-- Settings (Admin -> Coins -> Settings). All default to "off".
INSERT IGNORE INTO coin_settings (setting_key, setting_value) VALUES
    ('monthly_cash_budget_inr',     '0'),   -- 0 = no limit; otherwise gift card / top-up redemptions stop when this month's total reaches it
    ('coin_expiry_days',            '0'),   -- 0 = coins never expire; see Rewards Terms (30 days' notice) before turning on
    ('streak_freeze_cooldown_days', '7');   -- Pro: a missed day is forgiven at most once in this many days
