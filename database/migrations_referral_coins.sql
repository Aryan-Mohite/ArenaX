-- =============================================================================
-- Referral rewards now pay Arena Coins (safe to re-run)
-- =============================================================================
-- Referrals used to pay XP into users.xp_balance, but nothing in the product
-- spends XP. Activated referrals now pay Arena Coins through the coin ledger
-- (reason 'referral'), held for a few days and capped per month because coins
-- can be redeemed for gift cards. Old XP rows and users.xp_balance are left
-- untouched.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_referral_coins.sql
-- =============================================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'referral_rewards' AND COLUMN_NAME = 'coins_amount'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE referral_rewards ADD COLUMN coins_amount INT NOT NULL DEFAULT 0',
  'SELECT ''referral_rewards.coins_amount already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Admin-editable settings (Admin -> Coins -> Settings). Defaults are a starting
-- point: 200 coins = Rs.2 at the default exchange rate.
INSERT IGNORE INTO coin_settings (setting_key, setting_value) VALUES
    ('earn_referral',        '200'),   -- coins to the referrer per activated friend
    ('referral_hold_days',   '7'),     -- days the coins stay pending before they vest
    ('referral_monthly_cap', '10');    -- max coin-paying referrals per referrer per month
