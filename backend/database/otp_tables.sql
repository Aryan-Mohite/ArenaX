-- ─── OTP / Email Verification Tables ─────────────────────────────────────────
-- Run this migration once against your existing database.

-- 1. Add email_verified column to users if it doesn't exist
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Pending registrations — stores credentials until OTP is confirmed
CREATE TABLE IF NOT EXISTS pending_verifications (
  email         TEXT        PRIMARY KEY,
  username      TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  otp           TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-clean expired rows so the table never grows unbounded
CREATE INDEX IF NOT EXISTS idx_pending_verifications_expires
  ON pending_verifications (expires_at);

-- 3. Password reset requests
CREATE TABLE IF NOT EXISTS password_resets (
  email      TEXT        PRIMARY KEY,
  otp        TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT         NOT NULL DEFAULT 0,
  verified   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_expires
  ON password_resets (expires_at);

-- 4. Optional: scheduled cleanup job (run via pg_cron or a cron job)
-- DELETE FROM pending_verifications WHERE expires_at < NOW();
-- DELETE FROM password_resets WHERE expires_at < NOW();
