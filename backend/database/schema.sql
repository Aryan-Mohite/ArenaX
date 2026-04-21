-- =============================================================================
-- ArenaX Esports Platform — Clean Schema
-- Self-hosted game data (no external API dependencies)
-- =============================================================================

-- ─── Core tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    profile_picture TEXT,
    country        VARCHAR(50),
    region         VARCHAR(50),
    bio            TEXT,
    status         VARCHAR(20) DEFAULT 'active',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login     TIMESTAMP
);

-- Games table — driven entirely by data/games.json (no RAWG)
CREATE TABLE IF NOT EXISTS games (
    game_id      SERIAL PRIMARY KEY,
    game_name    VARCHAR(100) UNIQUE NOT NULL,
    genre        VARCHAR(50),
    developer    VARCHAR(100),
    release_year INT,
    cover_image  TEXT,
    icon         TEXT,
    rating       DECIMAL(3,2),
    platforms    TEXT,          -- e.g. "PC / Console" or "Mobile"
    description  TEXT,
    slug         VARCHAR(200),
    screenshots  TEXT[],
    status       VARCHAR(20) DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_name ON games(game_name);
CREATE INDEX        IF NOT EXISTS idx_games_slug ON games(slug);

CREATE TABLE IF NOT EXISTS user_game_profile (
    profile_id     SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(user_id) ON DELETE CASCADE,
    game_id        INT REFERENCES games(game_id) ON DELETE CASCADE,
    rank           VARCHAR(50),
    role           VARCHAR(50),
    win_rate       DECIMAL(5,2),
    matches_played INT DEFAULT 0,
    elo_rating     INT,
    UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS teams (
    team_id     SERIAL PRIMARY KEY,
    team_name   VARCHAR(100) UNIQUE NOT NULL,
    logo        TEXT,
    region      VARCHAR(50),
    created_by  INT REFERENCES users(user_id),
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    team_member_id SERIAL PRIMARY KEY,
    team_id        INT REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id        INT REFERENCES users(user_id) ON DELETE CASCADE,
    role           VARCHAR(50),
    joined_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status         VARCHAR(20) DEFAULT 'active',
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
    invite_id  SERIAL PRIMARY KEY,
    team_id    INT REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id    INT REFERENCES users(user_id) ON DELETE CASCADE,
    invited_by INT REFERENCES users(user_id),
    status     VARCHAR(20) DEFAULT 'pending',
    sent_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_organizers (
    organizer_id      SERIAL PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    website           TEXT,
    contact_email     VARCHAR(100),
    verified          BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id         SERIAL PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    game_id               INT REFERENCES games(game_id),
    organizer_id          INT REFERENCES tournament_organizers(organizer_id),
    prize_pool            DECIMAL(12,2),
    entry_fee             DECIMAL(10,2),
    region                VARCHAR(50),
    format                VARCHAR(50),
    start_date            DATE,
    end_date              DATE,
    registration_deadline DATE,
    status                VARCHAR(20) DEFAULT 'upcoming',
    image_url             TEXT,
    description           TEXT,
    organizer_name        VARCHAR(150),
    location              VARCHAR(150),
    join_link             TEXT,
    created_by            INT REFERENCES users(user_id),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
    registration_id SERIAL PRIMARY KEY,
    tournament_id   INT REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    team_id         INT REFERENCES teams(team_id) ON DELETE CASCADE,
    registered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status          VARCHAR(20) DEFAULT 'pending',
    UNIQUE(tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS matches (
    match_id        SERIAL PRIMARY KEY,
    tournament_id   INT REFERENCES tournaments(tournament_id),
    team1_id        INT REFERENCES teams(team_id),
    team2_id        INT REFERENCES teams(team_id),
    match_date      TIMESTAMP,
    status          VARCHAR(20) DEFAULT 'scheduled',
    winner_team_id  INT REFERENCES teams(team_id),
    score           VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS match_player_stats (
    stat_id    SERIAL PRIMARY KEY,
    match_id   INT REFERENCES matches(match_id) ON DELETE CASCADE,
    user_id    INT REFERENCES users(user_id),
    kills      INT DEFAULT 0,
    deaths     INT DEFAULT 0,
    assists    INT DEFAULT 0,
    damage     INT DEFAULT 0,
    mvp        BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS communities (
    community_id SERIAL PRIMARY KEY,
    game_id      INT REFERENCES games(game_id),
    name         VARCHAR(100),
    description  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_posts (
    post_id      SERIAL PRIMARY KEY,
    community_id INT REFERENCES communities(community_id) ON DELETE CASCADE,
    user_id      INT REFERENCES users(user_id),
    title        VARCHAR(200),
    content      TEXT,
    image_url    TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    upvotes      INT DEFAULT 0,
    downvotes    INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_comments (
    comment_id SERIAL PRIMARY KEY,
    post_id    INT REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id    INT REFERENCES users(user_id),
    content    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_id       INT REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id     INT REFERENCES users(user_id) ON DELETE CASCADE,
    status        VARCHAR(20) DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    message_id  SERIAL PRIMARY KEY,
    sender_id   INT REFERENCES users(user_id),
    receiver_id INT REFERENCES users(user_id),
    content     TEXT,
    sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS team_finder_posts (
    post_id        SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(user_id),
    game_id        INT REFERENCES games(game_id),
    rank_required  VARCHAR(50),
    role_required  VARCHAR(50),
    region         VARCHAR(50),
    description    TEXT,
    status         VARCHAR(20) DEFAULT 'open',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_finder_applications (
    application_id SERIAL PRIMARY KEY,
    post_id        INT REFERENCES team_finder_posts(post_id) ON DELETE CASCADE,
    user_id        INT REFERENCES users(user_id),
    message        TEXT,
    status         VARCHAR(20) DEFAULT 'pending',
    applied_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS streams (
    stream_id    SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(user_id),
    platform     VARCHAR(50),
    stream_url   TEXT,
    game_id      INT REFERENCES games(game_id),
    title        VARCHAR(200),
    started_at   TIMESTAMP,
    status       VARCHAR(20),
    viewer_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50),
    message         TEXT,
    related_id      INT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achievements (
    achievement_id SERIAL PRIMARY KEY,
    name           VARCHAR(100),
    description    TEXT,
    icon           TEXT
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_achievement_id SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id      INT REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    report_id     SERIAL PRIMARY KEY,
    reported_user INT REFERENCES users(user_id),
    reported_by   INT REFERENCES users(user_id),
    reason        TEXT,
    status        VARCHAR(20) DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    user_id           INT REFERENCES users(user_id),
    type              VARCHAR(50),
    data              JSONB,
    generated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_tournaments_game   ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team  ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages(receiver_id);

-- =============================================================================
-- MIGRATION: Clean up old RAWG-era data and columns
-- Run this section ONCE on an existing database.
-- =============================================================================

-- 1. Remove all old seeded games and their communities (they'll be re-added via /api/games/sync)
DELETE FROM communities
WHERE game_id IN (SELECT game_id FROM games);

DELETE FROM games;

-- 2. Drop RAWG-specific columns that are no longer needed
ALTER TABLE games
  DROP COLUMN IF EXISTS rawg_id,
  DROP COLUMN IF EXISTS rating_count,
  DROP COLUMN IF EXISTS metacritic,
  DROP COLUMN IF EXISTS website;

-- After running this file:
-- → Start your backend server
-- → POST /api/games/sync   (or click "Sync Games" in the admin panel)
-- → All 20 games from data/games.json will be inserted + communities auto-created


CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Step 1: Fix cascade constraints
ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_game_id_fkey,
  ADD CONSTRAINT communities_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE;

ALTER TABLE community_posts
  DROP CONSTRAINT IF EXISTS community_posts_community_id_fkey,
  ADD CONSTRAINT community_posts_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE;

ALTER TABLE post_comments
  DROP CONSTRAINT IF EXISTS post_comments_post_id_fkey,
  ADD CONSTRAINT post_comments_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE;

ALTER TABLE user_game_profile
  DROP CONSTRAINT IF EXISTS user_game_profile_game_id_fkey,
  ADD CONSTRAINT user_game_profile_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_game_id_fkey,
  ADD CONSTRAINT tournaments_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE;



CREATE TABLE IF NOT EXISTS user_follows (
  follower_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);


-- ─── Migration: Team Finder new features ─────────────────────────────────────
-- Run once against your PostgreSQL database

-- 1. Add deadline column to team_finder_posts
ALTER TABLE team_finder_posts
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ DEFAULT NULL;

-- 2. Add status column to team_finder_applications
--    Possible values: 'pending' | 'accepted' | 'rejected'
ALTER TABLE team_finder_applications
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 3. Backfill existing applications as 'pending'
UPDATE team_finder_applications SET status = 'pending' WHERE status IS NULL;

-- 4. Optional index: quickly query open non-expired posts
CREATE INDEX IF NOT EXISTS idx_tfp_status_deadline
  ON team_finder_posts (status, deadline);

-- 5. Optional index: accepted applications for chat gate
CREATE INDEX IF NOT EXISTS idx_tfa_status
  ON team_finder_applications (status);



-- 1. Add game_id to teams so each team belongs to a game
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS game_id INT REFERENCES games(game_id) ON DELETE SET NULL;

-- 2. Add team_id to team_finder_posts (nullable for backward compat)
ALTER TABLE team_finder_posts
  ADD COLUMN IF NOT EXISTS team_id INT REFERENCES teams(team_id) ON DELETE SET NULL;

-- 3. Extend application status to support the new 3-stage flow:
--    pending → draft_accepted (captain chats) → accepted (on roster) | rejected
--    The column already exists with values 'pending'|'accepted'|'rejected'
--    We just need to allow 'draft_accepted'
ALTER TABLE team_finder_applications
  DROP CONSTRAINT IF EXISTS team_finder_applications_status_check;

-- 4. Index for faster team lookups
CREATE INDEX IF NOT EXISTS idx_teams_game      ON teams(game_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_tfp_team        ON team_finder_posts(team_id);

-- 5. comment_count column on community_posts (if missing)
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;




  