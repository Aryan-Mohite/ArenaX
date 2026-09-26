-- =============================================================================
-- §3 COLLEGE / CAMPUS MODULE — additive migration
-- =============================================================================
-- Run after migrations_section1_payments.sql (college licensing reuses §1's
-- plans/subscriptions and the org_id column reserved back then). Independent
-- of §2. Safe to re-run: every statement is IF NOT EXISTS-guarded, and the
-- two FK-bearing ALTERs use the same information_schema-guard pattern already
-- used for tournaments.source/external_id earlier in the main schema file
-- (plain "ADD COLUMN IF NOT EXISTS" doesn't cover ADD CONSTRAINT in MySQL 8).
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section3_college.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS colleges (
    college_id   INT AUTO_INCREMENT  PRIMARY KEY,
    name         VARCHAR(150)        NOT NULL,
    slug         VARCHAR(200)        UNIQUE NOT NULL,   -- public leaderboard URL: /colleges/:slug
    city         VARCHAR(100),
    state        VARCHAR(100),
    logo_url     TEXT,
    status       VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    claimed_by   INT,                                    -- the ambassador who submitted the claim
    approved_by  INT,
    approved_at  DATETIME,
    created_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_college_claimed_by  FOREIGN KEY (claimed_by)  REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_college_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_colleges_status ON colleges(status);
CREATE INDEX idx_colleges_slug   ON colleges(slug);

-- ─── users.college_id ───────────────────────────────────────────────────────
-- Nullable and opt-in — joining a college is never required to use ArenaX.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'college_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN college_id INT NULL AFTER region',
  'SELECT ''users.college_id already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_college'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE SET NULL',
  'SELECT ''fk_users_college already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX idx_users_college ON users(college_id);

-- ─── teams.college_id ───────────────────────────────────────────────────────
-- A team can represent a college — defaults from the captain's college at
-- creation time (see collegeController-driven change in teamController.js),
-- editable after by the captain. This is what §3's college-scoped Team
-- Finder filter, inter-college standings, and the college leaderboard all
-- read from — no separate "college roster" table needed.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'college_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE teams ADD COLUMN college_id INT NULL AFTER region',
  'SELECT ''teams.college_id already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND CONSTRAINT_NAME = 'fk_teams_college'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE teams ADD CONSTRAINT fk_teams_college FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE SET NULL',
  'SELECT ''fk_teams_college already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX idx_teams_college ON teams(college_id);

-- ─── tournaments.is_inter_college ───────────────────────────────────────────
-- Inter-college bracket type: when true, the tournament page shows a
-- "College Standings" tab alongside the normal bracket. Standings are
-- computed on the fly by aggregating `matches` results through
-- `teams.college_id` — no separate standings table, matching the existing
-- "minimal surface area" convention (see tournamentController.getCollegeStandings).
ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS is_inter_college BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── College annual-license plan (§1 hook, not charged yet) ─────────────────
-- Reuses `subscriptions.org_id`, reserved in §1 for exactly this. No
-- checkout flow is wired up for it — an admin grants/revokes it directly via
-- POST /api/admin/colleges/:id/license, so it's a flip-on-later entitlement,
-- not a live payment path, until a real paying college pilot exists.
INSERT IGNORE INTO plans (plan_key, name, description, price, billing_cycle, feature_flags) VALUES
    ('college_annual', 'College — Annual License',
     'Verified college badge, custom leaderboard branding, ability to host inter-college tournaments.',
     4999, 'annual',
     JSON_OBJECT('verified_college', true, 'custom_branding', true, 'host_inter_college', true));
