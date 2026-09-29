-- ============================================================
-- Section 10: Organization-tier read-only API keys
-- Roadmap §2: "Organization tier unlocks ... read-only API key for
-- their own tournament data." The `api_access` plan flag already
-- existed (migrations_section2b); this adds the keys themselves.
--
-- Only a SHA-256 hash of each key is stored. The raw key is shown to
-- the organizer exactly once, at creation.
-- Safe to re-run (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS organizer_api_keys (
    key_id        INT AUTO_INCREMENT  PRIMARY KEY,
    user_id       INT                 NOT NULL,
    label         VARCHAR(60)         NOT NULL DEFAULT 'Default',
    key_prefix    VARCHAR(12)         NOT NULL,           -- first chars, so the UI can identify a key
    key_hash      CHAR(64)            NOT NULL,           -- sha256 hex of the raw key
    last_used_at  DATETIME,
    revoked_at    DATETIME,
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_oak_hash (key_hash),
    CONSTRAINT fk_oak_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oak_user ON organizer_api_keys(user_id);
