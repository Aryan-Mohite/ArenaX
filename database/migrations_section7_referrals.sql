-- =============================================================================
-- §7 REFERRAL & AMBASSADOR SYSTEM — additive migration
-- =============================================================================
-- Independent of §3 (paired with it in the roadmap's build order as the
-- acquisition engine, but no data dependency between them). Safe to re-run:
-- column adds use the information_schema-guard pattern already used for
-- §3's FK-bearing ALTERs and for tournaments.source/external_id.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section7_referrals.sql
-- =============================================================================

-- ─── users.referral_code / referred_by / xp_balance ─────────────────────────
-- Every user gets a shareable referral_code at signup (not just curated
-- ambassadors — anyone can refer). referred_by records who they signed up
-- through, if anyone. xp_balance is the reward currency ledger balance —
-- XP/credit, never cash, per the roadmap's anti-junk-signup design.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'referral_code'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) NULL',
  'SELECT ''users.referral_code already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_referral_code'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_referral_code (referral_code)',
  'SELECT ''uq_users_referral_code already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'referred_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN referred_by INT NULL',
  'SELECT ''users.referred_by already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_referred_by'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by) REFERENCES users(user_id) ON DELETE SET NULL',
  'SELECT ''fk_users_referred_by already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX idx_users_referred_by ON users(referred_by);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp_balance INT NOT NULL DEFAULT 0;

-- ─── pending_verifications.referral_code_input ──────────────────────────────
-- Registration is two-step (send-otp → verify). The code the new user typed
-- in at step 1 has to survive until step 2, where the account (and its own
-- referral_code) actually gets created — same reason password_hash already
-- lives on this table.
ALTER TABLE pending_verifications
    ADD COLUMN IF NOT EXISTS referral_code_input VARCHAR(20) NULL;

-- ─── referral_rewards ────────────────────────────────────────────────────────
-- One row per referred signup. Stays 'pending' until the referred user hits
-- the activation bar (profile complete + game selected + joined a
-- tournament/community — see referralService.checkActivation), at which
-- point xp_amount is set and status flips to 'credited'. This is what makes
-- "rewards owed" on the ambassador dashboard mean something real instead of
-- just a raw signup count.
CREATE TABLE IF NOT EXISTS referral_rewards (
    reward_id         INT AUTO_INCREMENT  PRIMARY KEY,
    referrer_id       INT                 NOT NULL,
    referred_user_id  INT                 NOT NULL UNIQUE,   -- one referral record per referred user
    xp_amount         INT                 NOT NULL DEFAULT 0,
    status            VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | credited
    credited_at       DATETIME,
    created_at        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rr_referrer FOREIGN KEY (referrer_id)      REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rr_referred FOREIGN KEY (referred_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rr_referrer ON referral_rewards(referrer_id, status);

-- ─── Backfill referral codes for existing users ─────────────────────────────
-- Anyone who registered before this migration needs a code too, or they'd
-- have nothing to share. Deterministic, collision-safe: username + user_id
-- (user_id is already unique, so this can never collide).
UPDATE users
   SET referral_code = CONCAT(UPPER(LEFT(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', ''), 10)), user_id)
 WHERE referral_code IS NULL;
