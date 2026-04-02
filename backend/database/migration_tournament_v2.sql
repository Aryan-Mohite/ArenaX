-- Migration: add organizer fields + extra tournament metadata
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS image_url        TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS organizer_name   VARCHAR(150),
  ADD COLUMN IF NOT EXISTS location         VARCHAR(150),
  ADD COLUMN IF NOT EXISTS join_link        TEXT,
  ADD COLUMN IF NOT EXISTS created_by       INT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
