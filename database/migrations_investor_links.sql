-- Shareable, revocable read-only links to the investor traction page (safe to re-run).
-- Only a SHA-256 hash of the token is stored; the raw link is shown once at creation.
CREATE TABLE IF NOT EXISTS investor_links (
  link_id        INT AUTO_INCREMENT PRIMARY KEY,
  token_hash     CHAR(64)     NOT NULL,
  label          VARCHAR(120) NOT NULL,
  created_by     INT          NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     DATETIME     NOT NULL,
  revoked_at     DATETIME     NULL,
  view_count     INT          NOT NULL DEFAULT 0,
  last_viewed_at DATETIME     NULL,
  UNIQUE KEY uq_investor_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
