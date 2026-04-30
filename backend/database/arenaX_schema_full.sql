-- =============================================================================
-- ArenaX Esports Platform — Complete Schema (v3.0)
-- Includes: Core tables + Archive system + Triggers + Restore functions
-- PostgreSQL 14+
-- =============================================================================
-- Usage (fresh install):
--   1. psql -U postgres -d your_db -f arenaX_schema_full.sql
--   2. psql -U postgres -d your_db -f arenaX_seed.sql
-- =============================================================================
-- This file is fully idempotent — safe to re-run on an existing database.
-- All statements use IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS
-- is NOT used (no NOTICE noise on first run).
-- =============================================================================

BEGIN;

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- PART 1 — CORE TABLES & INDEXES
-- =============================================================================
-- =============================================================================
-- 1. USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT         NOT NULL,
    profile_picture TEXT,
    country         VARCHAR(50),
    region          VARCHAR(50),
    bio             TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | banned | suspended
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);


-- =============================================================================
-- 2. GAMES
-- =============================================================================

CREATE TABLE IF NOT EXISTS games (
    game_id      SERIAL PRIMARY KEY,
    game_name    VARCHAR(100) UNIQUE NOT NULL,
    slug         VARCHAR(200) UNIQUE NOT NULL,
    genre        VARCHAR(50),
    developer    VARCHAR(100),
    release_year INT,
    cover_image  TEXT,
    icon         TEXT,
    rating       DECIMAL(3,2),
    platforms    VARCHAR(50),      -- 'PC / Console' | 'Mobile'
    description  TEXT,
    screenshots  TEXT[],           -- array of image URLs
    status       VARCHAR(20) NOT NULL DEFAULT 'active'  -- active | inactive
);

CREATE INDEX IF NOT EXISTS idx_games_slug   ON games(slug);
CREATE INDEX IF NOT EXISTS idx_games_genre  ON games(genre);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);


-- =============================================================================
-- 3. USER → GAME PROFILES  (per-game rank / stats)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_game_profile (
    profile_id     SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id        INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    rank           VARCHAR(50),
    role           VARCHAR(50),
    win_rate       DECIMAL(5,2),
    matches_played INT          NOT NULL DEFAULT 0,
    elo_rating     INT          NOT NULL DEFAULT 1000,
    UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_ugp_user ON user_game_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_ugp_game ON user_game_profile(game_id);


-- =============================================================================
-- 4. SOCIAL — follows & friendships
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_follows (
    follower_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    following_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);


CREATE TABLE IF NOT EXISTS friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | blocked
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user   ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);


-- =============================================================================
-- 5. DIRECT MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
    message_id  SERIAL PRIMARY KEY,
    sender_id   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    sent_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);


-- =============================================================================
-- 6. TEAMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS teams (
    team_id     SERIAL PRIMARY KEY,
    team_name   VARCHAR(100) UNIQUE NOT NULL,
    game_id     INT REFERENCES games(game_id) ON DELETE SET NULL,
    logo        TEXT,
    region      VARCHAR(50),
    description TEXT,
    created_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_game       ON teams(game_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);


CREATE TABLE IF NOT EXISTS team_members (
    team_member_id SERIAL PRIMARY KEY,
    team_id        INT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role           VARCHAR(50)  NOT NULL DEFAULT 'member',  -- captain | member | sub
    status         VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | inactive
    joined_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);


CREATE TABLE IF NOT EXISTS team_invitations (
    invite_id  SERIAL PRIMARY KEY,
    team_id    INT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invited_by INT          REFERENCES users(user_id) ON DELETE SET NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
    sent_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user ON team_invitations(user_id);


-- =============================================================================
-- 7. TEAM FINDER
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_finder_posts (
    post_id       SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id       INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    team_id       INT          REFERENCES teams(team_id) ON DELETE SET NULL,
    rank_required VARCHAR(50),
    role_required VARCHAR(50),
    region        VARCHAR(50),
    description   TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'open',  -- open | closed | expired
    deadline      TIMESTAMPTZ,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfp_status_deadline ON team_finder_posts(status, deadline);
CREATE INDEX IF NOT EXISTS idx_tfp_game            ON team_finder_posts(game_id);
CREATE INDEX IF NOT EXISTS idx_tfp_team            ON team_finder_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_tfp_user            ON team_finder_posts(user_id);


CREATE TABLE IF NOT EXISTS team_finder_applications (
    application_id SERIAL PRIMARY KEY,
    post_id        INT NOT NULL REFERENCES team_finder_posts(post_id) ON DELETE CASCADE,
    user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message        TEXT,
    -- pending → draft_accepted (captain reviewing) → accepted | rejected
    status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
    applied_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfa_post   ON team_finder_applications(post_id);
CREATE INDEX IF NOT EXISTS idx_tfa_user   ON team_finder_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tfa_status ON team_finder_applications(status);


-- =============================================================================
-- 8. TOURNAMENT ORGANIZERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournament_organizers (
    organizer_id      SERIAL PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    website           TEXT,
    contact_email     VARCHAR(100),
    verified          BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 9. TOURNAMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id         SERIAL PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    game_id               INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    organizer_id          INT          REFERENCES tournament_organizers(organizer_id) ON DELETE SET NULL,
    created_by            INT          REFERENCES users(user_id) ON DELETE SET NULL,
    prize_pool            DECIMAL(12,2),
    entry_fee             DECIMAL(10,2) DEFAULT 0,
    region                VARCHAR(50),
    format                VARCHAR(50),    -- 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'
    start_date            DATE,
    end_date              DATE,
    registration_deadline DATE,
    status                VARCHAR(20) NOT NULL DEFAULT 'upcoming',  -- upcoming | ongoing | completed | cancelled
    image_url             TEXT,
    description           TEXT,
    organizer_name        VARCHAR(150),
    location              VARCHAR(150),
    join_link             TEXT,
    created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournaments_game   ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_region ON tournaments(region);


CREATE TABLE IF NOT EXISTS tournament_registrations (
    registration_id SERIAL PRIMARY KEY,
    tournament_id   INT NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    team_id         INT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | confirmed | disqualified
    registered_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_tourney_reg_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tourney_reg_team       ON tournament_registrations(team_id);


-- =============================================================================
-- 10. MATCHES
-- =============================================================================

CREATE TABLE IF NOT EXISTS matches (
    match_id       SERIAL PRIMARY KEY,
    tournament_id  INT REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    team1_id       INT REFERENCES teams(team_id) ON DELETE SET NULL,
    team2_id       INT REFERENCES teams(team_id) ON DELETE SET NULL,
    winner_team_id INT REFERENCES teams(team_id) ON DELETE SET NULL,
    match_date     TIMESTAMP,
    status         VARCHAR(20) NOT NULL DEFAULT 'scheduled',  -- scheduled | live | completed | cancelled
    score          VARCHAR(20),    -- e.g. '2-1'
    round          VARCHAR(50),    -- e.g. 'Quarter Final'
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_status     ON matches(status);


CREATE TABLE IF NOT EXISTS match_player_stats (
    stat_id    SERIAL PRIMARY KEY,
    match_id   INT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    kills      INT     NOT NULL DEFAULT 0,
    deaths     INT     NOT NULL DEFAULT 0,
    assists    INT     NOT NULL DEFAULT 0,
    damage     INT     NOT NULL DEFAULT 0,
    mvp        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_stats_match ON match_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_user  ON match_player_stats(user_id);


-- =============================================================================
-- 11. COMMUNITIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS communities (
    community_id SERIAL PRIMARY KEY,
    game_id      INT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communities_game ON communities(game_id);


CREATE TABLE IF NOT EXISTS community_posts (
    post_id       SERIAL PRIMARY KEY,
    community_id  INT NOT NULL REFERENCES communities(community_id) ON DELETE CASCADE,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title         VARCHAR(200),
    content       TEXT,
    image_url     TEXT,
    upvotes       INT NOT NULL DEFAULT 0,
    downvotes     INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,   -- denormalised counter, kept in sync by app
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user      ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created   ON community_posts(created_at DESC);


CREATE TABLE IF NOT EXISTS post_comments (
    comment_id SERIAL PRIMARY KEY,
    post_id    INT NOT NULL REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id);


-- =============================================================================
-- 12. STREAMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS streams (
    stream_id    SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id      INT          REFERENCES games(game_id) ON DELETE SET NULL,
    platform     VARCHAR(50),    -- 'twitch' | 'youtube' | 'other'
    stream_url   TEXT,
    title        VARCHAR(200),
    status       VARCHAR(20)  NOT NULL DEFAULT 'live',  -- live | ended
    viewer_count INT          NOT NULL DEFAULT 0,
    started_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_streams_user   ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_game   ON streams(game_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);


-- =============================================================================
-- 13. ACHIEVEMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS achievements (
    achievement_id SERIAL PRIMARY KEY,
    name           VARCHAR(100) UNIQUE NOT NULL,
    description    TEXT,
    icon           TEXT
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_achievement_id SERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id      INT NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);


-- =============================================================================
-- 14. NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,   -- 'team_invite' | 'match_result' | 'tournament' | 'follow' | 'message' | 'achievement'
    message         TEXT        NOT NULL,
    related_id      INT,                    -- generic FK to the relevant entity id
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);


-- =============================================================================
-- 15. REPORTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS reports (
    report_id     SERIAL PRIMARY KEY,
    reported_user INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reported_by   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason        TEXT        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | reviewed | resolved | dismissed
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (reported_user <> reported_by)
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status);


-- =============================================================================
-- 16. AI RECOMMENDATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    user_id           INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type              VARCHAR(50) NOT NULL,    -- 'team' | 'tournament' | 'game' | 'player'
    data              JSONB,
    generated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_rec_user ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_type ON ai_recommendations(type);



-- =============================================================================
-- PART 2 — ARCHIVE SYSTEM
-- Tables, trigger functions, triggers, restore functions, views, retention
-- =============================================================================
-- Strategy:
--   Every deletable entity gets a mirror archive table + a BEFORE DELETE trigger
--   that snapshots the row (and its children as JSONB) before deletion proceeds.
--   No app code changes needed — triggers fire automatically on any DELETE.
--   Users are soft-deleted only (status = 'deleted') — never hard-deleted.
-- =============================================================================

-- =============================================================================
-- 0. UTILITY — single-row metadata table for archive config (optional)
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO archive_config VALUES
    ('version',       '1.0'),
    ('enabled',       'true'),
    ('retention_days','365')     -- after this many days archived rows can be purged
ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- 1. ARCHIVE — TOURNAMENTS
--    Captures the tournament row + all registrations + all matches (+ their
--    player stats) at the moment of deletion.
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_tournaments (
    -- Mirror of tournaments --
    tournament_id         INT          NOT NULL,
    name                  VARCHAR(150),
    game_id               INT,
    organizer_id          INT,
    created_by            INT,
    prize_pool            DECIMAL(12,2),
    entry_fee             DECIMAL(10,2),
    region                VARCHAR(50),
    format                VARCHAR(50),
    start_date            DATE,
    end_date              DATE,
    registration_deadline DATE,
    status                VARCHAR(20),
    image_url             TEXT,
    description           TEXT,
    organizer_name        VARCHAR(150),
    location              VARCHAR(150),
    join_link             TEXT,
    created_at            TIMESTAMP,
    -- Snapshot of child records --
    registrations_snapshot  JSONB,   -- array of tournament_registration rows
    matches_snapshot        JSONB,   -- array of match rows (each with player_stats)
    -- Archive audit --
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by     INT,             -- user_id of who triggered the delete (set by app)
    archive_reason  TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_tournaments_id     ON archive_tournaments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_arch_tournaments_at     ON archive_tournaments(archived_at);
CREATE INDEX IF NOT EXISTS idx_arch_tournaments_status ON archive_tournaments(status);


-- Trigger function
CREATE OR REPLACE FUNCTION fn_archive_tournament()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_registrations JSONB;
    v_matches       JSONB;
BEGIN
    -- Snapshot registrations
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
    INTO v_registrations
    FROM tournament_registrations r
    WHERE r.tournament_id = OLD.tournament_id;

    -- Snapshot matches with their player stats
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'match',        to_jsonb(m),
            'player_stats', (
                SELECT COALESCE(jsonb_agg(to_jsonb(ps)), '[]'::jsonb)
                FROM match_player_stats ps
                WHERE ps.match_id = m.match_id
            )
        )
    ), '[]'::jsonb)
    INTO v_matches
    FROM matches m
    WHERE m.tournament_id = OLD.tournament_id;

    INSERT INTO archive_tournaments (
        tournament_id, name, game_id, organizer_id, created_by,
        prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline,
        status, image_url, description, organizer_name, location, join_link, created_at,
        registrations_snapshot, matches_snapshot
    ) VALUES (
        OLD.tournament_id, OLD.name, OLD.game_id, OLD.organizer_id, OLD.created_by,
        OLD.prize_pool, OLD.entry_fee, OLD.region, OLD.format,
        OLD.start_date, OLD.end_date, OLD.registration_deadline,
        OLD.status, OLD.image_url, OLD.description, OLD.organizer_name, OLD.location, OLD.join_link, OLD.created_at,
        v_registrations, v_matches
    );

    RETURN OLD;  -- allow the DELETE to proceed
END;
$$;

CREATE TRIGGER trg_archive_tournament
    BEFORE DELETE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION fn_archive_tournament();


-- =============================================================================
-- 2. ARCHIVE — TEAM FINDER POSTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_team_finder_posts (
    post_id           INT          NOT NULL,
    user_id           INT,
    game_id           INT,
    team_id           INT,
    rank_required     VARCHAR(50),
    role_required     VARCHAR(50),
    region            VARCHAR(50),
    description       TEXT,
    status            VARCHAR(20),
    deadline          TIMESTAMPTZ,
    created_at        TIMESTAMP,
    -- Snapshot of applications
    applications_snapshot JSONB,   -- array of team_finder_application rows
    -- Archive audit
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by    INT,
    archive_reason TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_tfp_id     ON archive_team_finder_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_arch_tfp_user   ON archive_team_finder_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_arch_tfp_at     ON archive_team_finder_posts(archived_at);


CREATE OR REPLACE FUNCTION fn_archive_team_finder_post()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_applications JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
    INTO v_applications
    FROM team_finder_applications a
    WHERE a.post_id = OLD.post_id;

    INSERT INTO archive_team_finder_posts (
        post_id, user_id, game_id, team_id,
        rank_required, role_required, region, description,
        status, deadline, created_at,
        applications_snapshot
    ) VALUES (
        OLD.post_id, OLD.user_id, OLD.game_id, OLD.team_id,
        OLD.rank_required, OLD.role_required, OLD.region, OLD.description,
        OLD.status, OLD.deadline, OLD.created_at,
        v_applications
    );

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_team_finder_post
    BEFORE DELETE ON team_finder_posts
    FOR EACH ROW EXECUTE FUNCTION fn_archive_team_finder_post();


-- =============================================================================
-- 3. ARCHIVE — STREAMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_streams (
    stream_id    INT          NOT NULL,
    user_id      INT,
    game_id      INT,
    platform     VARCHAR(50),
    stream_url   TEXT,
    title        VARCHAR(200),
    status       VARCHAR(20),
    viewer_count INT,
    started_at   TIMESTAMP,
    ended_at     TIMESTAMP,
    -- peak viewer count recorded separately by app (optional enhancement)
    peak_viewers INT,
    -- Archive audit
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by    INT,
    archive_reason TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_streams_id   ON archive_streams(stream_id);
CREATE INDEX IF NOT EXISTS idx_arch_streams_user ON archive_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_arch_streams_at   ON archive_streams(archived_at);


CREATE OR REPLACE FUNCTION fn_archive_stream()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO archive_streams (
        stream_id, user_id, game_id, platform, stream_url, title,
        status, viewer_count, started_at, ended_at
    ) VALUES (
        OLD.stream_id, OLD.user_id, OLD.game_id, OLD.platform, OLD.stream_url, OLD.title,
        OLD.status, OLD.viewer_count, OLD.started_at, OLD.ended_at
    );

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_stream
    BEFORE DELETE ON streams
    FOR EACH ROW EXECUTE FUNCTION fn_archive_stream();


-- =============================================================================
-- 4. ARCHIVE — COMMUNITY POSTS  (+ comments snapshot)
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_community_posts (
    post_id       INT          NOT NULL,
    community_id  INT,
    user_id       INT,
    title         VARCHAR(200),
    content       TEXT,
    image_url     TEXT,
    upvotes       INT,
    downvotes     INT,
    comment_count INT,
    created_at    TIMESTAMP,
    -- Snapshot of comments
    comments_snapshot JSONB,
    -- Archive audit
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by    INT,
    archive_reason TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_cp_id   ON archive_community_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_arch_cp_user ON archive_community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_arch_cp_at   ON archive_community_posts(archived_at);


CREATE OR REPLACE FUNCTION fn_archive_community_post()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_comments JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
    INTO v_comments
    FROM post_comments c
    WHERE c.post_id = OLD.post_id;

    INSERT INTO archive_community_posts (
        post_id, community_id, user_id, title, content, image_url,
        upvotes, downvotes, comment_count, created_at,
        comments_snapshot
    ) VALUES (
        OLD.post_id, OLD.community_id, OLD.user_id, OLD.title, OLD.content, OLD.image_url,
        OLD.upvotes, OLD.downvotes, OLD.comment_count, OLD.created_at,
        v_comments
    );

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_community_post
    BEFORE DELETE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION fn_archive_community_post();


-- =============================================================================
-- 5. ARCHIVE — TEAMS  (+ members + invitations snapshots)
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_teams (
    team_id     INT          NOT NULL,
    team_name   VARCHAR(100),
    game_id     INT,
    logo        TEXT,
    region      VARCHAR(50),
    description TEXT,
    created_by  INT,
    created_at  TIMESTAMP,
    -- Snapshots
    members_snapshot     JSONB,
    invitations_snapshot JSONB,
    -- Archive audit
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by    INT,
    archive_reason TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_teams_id ON archive_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_arch_teams_at ON archive_teams(archived_at);


CREATE OR REPLACE FUNCTION fn_archive_team()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_members     JSONB;
    v_invitations JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    INTO v_members
    FROM team_members m
    WHERE m.team_id = OLD.team_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    INTO v_invitations
    FROM team_invitations i
    WHERE i.team_id = OLD.team_id;

    INSERT INTO archive_teams (
        team_id, team_name, game_id, logo, region, description, created_by, created_at,
        members_snapshot, invitations_snapshot
    ) VALUES (
        OLD.team_id, OLD.team_name, OLD.game_id, OLD.logo, OLD.region, OLD.description, OLD.created_by, OLD.created_at,
        v_members, v_invitations
    );

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_team
    BEFORE DELETE ON teams
    FOR EACH ROW EXECUTE FUNCTION fn_archive_team();


-- =============================================================================
-- 6. ARCHIVE — MATCHES  (+ player stats snapshot)
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_matches (
    match_id       INT          NOT NULL,
    tournament_id  INT,
    team1_id       INT,
    team2_id       INT,
    winner_team_id INT,
    match_date     TIMESTAMP,
    status         VARCHAR(20),
    score          VARCHAR(20),
    round          VARCHAR(50),
    created_at     TIMESTAMP,
    -- Snapshot of player stats
    player_stats_snapshot JSONB,
    -- Archive audit
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by    INT,
    archive_reason TEXT NOT NULL DEFAULT 'user_deleted'
);

CREATE INDEX IF NOT EXISTS idx_arch_matches_id         ON archive_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_arch_matches_tournament ON archive_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_arch_matches_at         ON archive_matches(archived_at);


CREATE OR REPLACE FUNCTION fn_archive_match()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    INTO v_stats
    FROM match_player_stats s
    WHERE s.match_id = OLD.match_id;

    INSERT INTO archive_matches (
        match_id, tournament_id, team1_id, team2_id, winner_team_id,
        match_date, status, score, round, created_at,
        player_stats_snapshot
    ) VALUES (
        OLD.match_id, OLD.tournament_id, OLD.team1_id, OLD.team2_id, OLD.winner_team_id,
        OLD.match_date, OLD.status, OLD.score, OLD.round, OLD.created_at,
        v_stats
    );

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_match
    BEFORE DELETE ON matches
    FOR EACH ROW EXECUTE FUNCTION fn_archive_match();


-- =============================================================================
-- 7. USERS — SOFT DELETE ONLY  (no hard delete, no archive table needed)
--    Users are NEVER hard-deleted. Instead the app sets status = 'deleted'.
--    All existing queries already filter on status = 'active' so deleted
--    users simply disappear from all public views automatically.
--    A separate deleted_users_log records when and why.
-- =============================================================================

CREATE TABLE IF NOT EXISTS deleted_users_log (
    log_id       SERIAL PRIMARY KEY,
    user_id      INT  NOT NULL,
    username     VARCHAR(50),
    email        VARCHAR(100),
    country      VARCHAR(50),
    deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_by   INT,          -- admin user_id, or same as user_id for self-delete
    delete_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_del_users_id ON deleted_users_log(user_id);
CREATE INDEX IF NOT EXISTS idx_del_users_at ON deleted_users_log(deleted_at);


-- =============================================================================
-- 8. UNIFIED ARCHIVE AUDIT LOG
--    Every archive event (all entity types) is recorded here.
--    Useful for admin dashboards, compliance, and restore lookups.
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_audit_log (
    log_id         SERIAL PRIMARY KEY,
    entity_type    VARCHAR(50)  NOT NULL,  -- 'tournament' | 'team' | 'stream' | ...
    entity_id      INT          NOT NULL,
    entity_name    TEXT,                   -- human-readable label for quick scanning
    archived_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    archived_by    INT,                    -- user_id of actor (NULL = system)
    archive_reason TEXT         NOT NULL DEFAULT 'user_deleted',
    restored_at    TIMESTAMPTZ,            -- filled in when/if restored
    restored_by    INT
);

CREATE INDEX IF NOT EXISTS idx_arch_audit_entity  ON archive_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_arch_audit_at      ON archive_audit_log(archived_at);
CREATE INDEX IF NOT EXISTS idx_arch_audit_restored ON archive_audit_log(restored_at) WHERE restored_at IS NULL;


-- =============================================================================
-- 9. CONVENIENCE VIEWS
--    Read-only views that join archive tables back to live lookup data
--    (game names, usernames) so admins can query archives in plain English.
-- =============================================================================

CREATE OR REPLACE VIEW v_archived_tournaments AS
SELECT
    at2.tournament_id,
    at2.name AS tournament_name,
    g.game_name,
    at2.status,
    at2.prize_pool,
    at2.region,
    at2.start_date,
    at2.end_date,
    at2.archived_at,
    at2.archive_reason,
    u.username AS archived_by_user,
    jsonb_array_length(at2.registrations_snapshot) AS registered_teams,
    jsonb_array_length(at2.matches_snapshot)        AS total_matches
FROM archive_tournaments at2
LEFT JOIN games g ON g.game_id = at2.game_id
LEFT JOIN users u ON u.user_id = at2.archived_by;


CREATE OR REPLACE VIEW v_archived_team_finder_posts AS
SELECT
    afp.post_id,
    afp.rank_required,
    afp.role_required,
    afp.region,
    afp.status,
    afp.deadline,
    afp.archived_at,
    afp.archive_reason,
    g.game_name,
    u.username  AS posted_by,
    t.team_name AS team,
    jsonb_array_length(afp.applications_snapshot) AS total_applications
FROM archive_team_finder_posts afp
LEFT JOIN games g ON g.game_id = afp.game_id
LEFT JOIN users u ON u.user_id = afp.user_id
LEFT JOIN teams t ON t.team_id = afp.team_id;


CREATE OR REPLACE VIEW v_archived_streams AS
SELECT
    ars.stream_id,
    ars.title,
    ars.platform,
    ars.status,
    ars.viewer_count,
    ars.started_at,
    ars.ended_at,
    EXTRACT(EPOCH FROM (COALESCE(ars.ended_at, ars.archived_at) - ars.started_at)) / 60 AS duration_minutes,
    ars.archived_at,
    ars.archive_reason,
    g.game_name,
    u.username AS streamer
FROM archive_streams ars
LEFT JOIN games g ON g.game_id = ars.game_id
LEFT JOIN users u ON u.user_id = ars.user_id;


CREATE OR REPLACE VIEW v_archived_community_posts AS
SELECT
    acp.post_id,
    acp.title,
    acp.upvotes,
    acp.downvotes,
    acp.comment_count,
    acp.created_at,
    acp.archived_at,
    acp.archive_reason,
    u.username AS author,
    c.name     AS community
FROM archive_community_posts acp
LEFT JOIN users       u ON u.user_id       = acp.user_id
LEFT JOIN communities c ON c.community_id  = acp.community_id;


CREATE OR REPLACE VIEW v_archived_teams AS
SELECT
    at2.team_id,
    at2.team_name,
    at2.region,
    at2.archived_at,
    at2.archive_reason,
    g.game_name,
    u.username AS created_by,
    jsonb_array_length(at2.members_snapshot) AS member_count
FROM archive_teams at2
LEFT JOIN games g ON g.game_id = at2.game_id
LEFT JOIN users u ON u.user_id = at2.created_by;


-- =============================================================================
-- 10. RESTORE HELPER FUNCTIONS
--     These are called by the backend when an admin clicks "Restore".
--     They re-insert the original row back into the live table and update
--     the audit log. Child records (members, registrations etc.) are NOT
--     auto-restored — that must be done intentionally by the admin.
-- =============================================================================

-- Restore a tournament (header row only; child records need manual handling)
CREATE OR REPLACE FUNCTION fn_restore_tournament(p_tournament_id INT, p_restored_by INT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO tournaments (
        tournament_id, name, game_id, organizer_id, created_by,
        prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline,
        status, image_url, description, organizer_name, location, join_link, created_at
    )
    SELECT
        tournament_id, name, game_id, organizer_id, created_by,
        prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline,
        'upcoming',   -- restored tournaments reset to upcoming for review
        image_url, description, organizer_name, location, join_link, created_at
    FROM archive_tournaments
    WHERE tournament_id = p_tournament_id
    ORDER BY archived_at DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;

    -- Mark as restored in audit log
    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'tournament' AND entity_id = p_tournament_id
      AND restored_at IS NULL;
END;
$$;


-- Restore a team (header row only)
CREATE OR REPLACE FUNCTION fn_restore_team(p_team_id INT, p_restored_by INT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO teams (team_id, team_name, game_id, logo, region, description, created_by, created_at)
    SELECT              team_id, team_name, game_id, logo, region, description, created_by, created_at
    FROM archive_teams
    WHERE team_id = p_team_id
    ORDER BY archived_at DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;

    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'team' AND entity_id = p_team_id
      AND restored_at IS NULL;
END;
$$;


-- Restore a stream
CREATE OR REPLACE FUNCTION fn_restore_stream(p_stream_id INT, p_restored_by INT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO streams (stream_id, user_id, game_id, platform, stream_url, title,
                         status, viewer_count, started_at, ended_at)
    SELECT               stream_id, user_id, game_id, platform, stream_url, title,
                         'ended',   viewer_count, started_at, ended_at   -- always restored as ended
    FROM archive_streams
    WHERE stream_id = p_stream_id
    ORDER BY archived_at DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;

    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'stream' AND entity_id = p_stream_id
      AND restored_at IS NULL;
END;
$$;


-- =============================================================================
-- 11. RETENTION CLEANUP — purge archive rows older than retention_days
--     Call this from a cron job / pg_cron on your schedule.
--     SELECT fn_purge_old_archives();
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_purge_old_archives()
RETURNS TABLE(table_name TEXT, rows_purged BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_days INT;
    v_cutoff TIMESTAMPTZ;
    v_count BIGINT;
BEGIN
    SELECT value::INT INTO v_days FROM archive_config WHERE key = 'retention_days';
    v_cutoff := NOW() - (v_days || ' days')::INTERVAL;

    DELETE FROM archive_tournaments       WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_tournaments'::TEXT, v_count;

    DELETE FROM archive_team_finder_posts WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_team_finder_posts'::TEXT, v_count;

    DELETE FROM archive_streams           WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_streams'::TEXT, v_count;

    DELETE FROM archive_community_posts   WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_community_posts'::TEXT, v_count;

    DELETE FROM archive_teams             WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_teams'::TEXT, v_count;

    DELETE FROM archive_matches           WHERE archived_at < v_cutoff;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'archive_matches'::TEXT, v_count;

    -- Clean up corresponding audit log entries
    DELETE FROM archive_audit_log
    WHERE archived_at < v_cutoff AND restored_at IS NULL;
END;
$$;



COMMIT;

-- =============================================================================
-- DEPLOY ORDER
-- =============================================================================
--   1.  psql -U postgres -d your_db -f arenaX_schema_full.sql   ← this file
--   2.  psql -U postgres -d your_db -f arenaX_seed.sql
-- =============================================================================
-- RE-RUNNING THIS FILE ON AN EXISTING DB IS SAFE:
--   • CREATE TABLE IF NOT EXISTS — skips existing tables
--   • CREATE OR REPLACE FUNCTION — updates function definitions
--   • CREATE TRIGGER — will error if trigger exists; use the idempotent
--     helper below if you need to re-run on a live DB:
--       DROP TRIGGER IF EXISTS trg_archive_tournament ON tournaments;
--       (then re-run this file)
-- =============================================================================
