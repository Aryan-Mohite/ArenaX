-- =============================================================================
-- §9 TRUST & SAFETY — additive migration
-- =============================================================================
-- Independent of everything else. Safe to re-run — same information_schema
-- guard pattern used for §3/§7's FK-bearing ALTERs, extended here to also
-- cover a CHECK constraint (MySQL 8 doesn't support "ADD CONSTRAINT IF NOT
-- EXISTS" for either kind).
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section9_trust_safety.sql
-- =============================================================================

-- ─── organizer_terms_acceptances ─────────────────────────────────────────────
-- Versioned (not just a single "accepted_at" column on users) so that if the
-- Organizer Terms / Tournament Agreement ever changes, past acceptances of
-- an old version stay on record rather than being overwritten — this is the
-- one part of this migration with real legal weight, so it's worth the
-- extra table over a shortcut column.
CREATE TABLE IF NOT EXISTS organizer_terms_acceptances (
    acceptance_id  INT AUTO_INCREMENT  PRIMARY KEY,
    user_id        INT                 NOT NULL,
    terms_version  VARCHAR(20)         NOT NULL,
    accepted_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address     VARCHAR(45),
    CONSTRAINT fk_ota_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ota_user_version ON organizer_terms_acceptances(user_id, terms_version);

-- ─── reports: extend to cover organizer-side abuse ──────────────────────────
-- Previously user-only (reported_user NOT NULL). Now a report targets
-- *either* a user *or* a tournament (fake tournaments, no-shows) — never
-- both, enforced by chk_rep_exactly_one_target below. Nothing about the
-- existing player-report rows or callers changes: reported_user stays
-- populated exactly as before for those.
SET @col_nullable := (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'reported_user'
);
SET @sql := IF(@col_nullable = 'NO',
  'ALTER TABLE reports MODIFY COLUMN reported_user INT NULL',
  'SELECT ''reports.reported_user already nullable'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS reported_tournament_id INT NULL,
    ADD COLUMN IF NOT EXISTS category VARCHAR(30) NULL,       -- e.g. 'fake_tournament', 'no_show', 'harassment', 'spam'
    ADD COLUMN IF NOT EXISTS resolution_note TEXT NULL,
    ADD COLUMN IF NOT EXISTS resolved_by INT NULL,
    ADD COLUMN IF NOT EXISTS resolved_at DATETIME NULL;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND CONSTRAINT_NAME = 'fk_rep_tournament'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE reports ADD CONSTRAINT fk_rep_tournament FOREIGN KEY (reported_tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE',
  'SELECT ''fk_rep_tournament already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND CONSTRAINT_NAME = 'fk_rep_resolved_by'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE reports ADD CONSTRAINT fk_rep_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL',
  'SELECT ''fk_rep_resolved_by already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @chk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND CONSTRAINT_NAME = 'chk_rep_exactly_one_target'
);
SET @sql := IF(@chk_exists = 0,
  'ALTER TABLE reports ADD CONSTRAINT chk_rep_exactly_one_target CHECK ((reported_user IS NOT NULL AND reported_tournament_id IS NULL) OR (reported_user IS NULL AND reported_tournament_id IS NOT NULL))',
  'SELECT ''chk_rep_exactly_one_target already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX idx_reports_tournament ON reports(reported_tournament_id);

-- ─── payment_disputes ────────────────────────────────────────────────────────
-- The "refund/dispute path" the roadmap asks for. Manual admin process, as
-- explicitly allowed by the roadmap ("even a manual admin process is fine
-- at first") — no automatic Razorpay refund call. Works today against
-- subscription payments (the only real money currently changing hands) and
-- will work unchanged against tournament entry-fee payments whenever those
-- go live, since it's keyed off `payments`, not off what the payment was for.
CREATE TABLE IF NOT EXISTS payment_disputes (
    dispute_id    INT AUTO_INCREMENT  PRIMARY KEY,
    payment_id    INT                 NOT NULL,
    user_id       INT                 NOT NULL,
    reason        TEXT                NOT NULL,
    status        VARCHAR(20)         NOT NULL DEFAULT 'open',  -- open | refunded | denied
    admin_note    TEXT,
    resolved_by   INT,
    resolved_at   DATETIME,
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pd_payment     FOREIGN KEY (payment_id)  REFERENCES payments(payment_id) ON DELETE CASCADE,
    CONSTRAINT fk_pd_user        FOREIGN KEY (user_id)     REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_pd_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pd_status ON payment_disputes(status);
