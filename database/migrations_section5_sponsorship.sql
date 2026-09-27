-- =============================================================================
-- §5 SPONSORSHIP GROUNDWORK — additive migration
-- =============================================================================
-- Independent of everything else. Safe to re-run — same information_schema
-- guard used for every FK-bearing ALTER in §3/§7/§9.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section5_sponsorship.sql
-- =============================================================================

-- ─── users.account_type ──────────────────────────────────────────────────────
-- Every user is 'gamer' by default. 'organizer' and 'admin' stay implicit,
-- exactly as they already are elsewhere in this codebase (an "organizer" is
-- just any user who's created a tournament; "admin" is derived from
-- ADMIN_EMAILS at login, never stored) — this migration doesn't change
-- that. 'sponsor' is the one new *stored* type, because sponsor status
-- needs to survive independently of any specific action a user takes,
-- and gates what `getFeaturedTournaments`/sponsor endpoints show them.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT ''gamer''',
  'SELECT ''users.account_type already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── sponsor_profiles ────────────────────────────────────────────────────────
-- One row per sponsor application. Mirrors the college-claim /
-- organizer-verification pattern exactly: apply → pending → admin
-- approves → (here) users.account_type flips to 'sponsor'.
CREATE TABLE IF NOT EXISTS sponsor_profiles (
    sponsor_id     INT AUTO_INCREMENT  PRIMARY KEY,
    user_id        INT                 NOT NULL UNIQUE,
    company_name   VARCHAR(150)        NOT NULL,
    website        VARCHAR(255),
    contact_email  VARCHAR(120),
    logo_url       TEXT,
    status         VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    approved_by    INT,
    approved_at    DATETIME,
    created_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sp_user        FOREIGN KEY (user_id)     REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_approved_by FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sponsor_profiles_status ON sponsor_profiles(status);

-- ─── featured_placements ─────────────────────────────────────────────────────
-- Admin-manageable "featured tournament" / banner placement slots. Manual
-- assignment only — no bidding marketplace, per the roadmap. starts_at/
-- ends_at are optional: NULL means "on until an admin deactivates it",
-- which is enough for a single admin manually managing a handful of slots.
CREATE TABLE IF NOT EXISTS featured_placements (
    placement_id   INT AUTO_INCREMENT  PRIMARY KEY,
    tournament_id  INT                 NOT NULL,
    sponsor_id     INT                 NOT NULL,
    slot_type      VARCHAR(30)         NOT NULL DEFAULT 'featured_tournament',  -- featured_tournament | banner
    is_active      BOOLEAN             NOT NULL DEFAULT TRUE,
    starts_at      DATETIME,
    ends_at        DATETIME,
    created_by     INT                 NOT NULL,
    created_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fp_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id)     ON DELETE CASCADE,
    CONSTRAINT fk_fp_sponsor    FOREIGN KEY (sponsor_id)    REFERENCES sponsor_profiles(sponsor_id)    ON DELETE CASCADE,
    CONSTRAINT fk_fp_created_by FOREIGN KEY (created_by)    REFERENCES users(user_id)                  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fp_active ON featured_placements(is_active, starts_at, ends_at);
