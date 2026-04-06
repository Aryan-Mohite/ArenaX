-- Migration: Add user follows system
-- Run this against your PostgreSQL database

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
