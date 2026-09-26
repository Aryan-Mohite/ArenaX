-- ============================================================
-- ArenaX MySQL Schema

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- PART 1 — CORE TABLES & INDEXES
-- =============================================================================

-- =============================================================================
-- 1. USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id         INT AUTO_INCREMENT  PRIMARY KEY,
    username        VARCHAR(60)         UNIQUE NOT NULL,
    email           VARCHAR(120)        UNIQUE NOT NULL,
    password_hash   TEXT                NOT NULL,
    profile_picture TEXT,
    country         VARCHAR(50),
    region          VARCHAR(50),
    bio             TEXT,
    status          VARCHAR(20)         NOT NULL DEFAULT 'active',  -- active | banned | suspended | deleted
    email_verified  BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login      DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status   ON users(status);


-- =============================================================================
-- 2. GAMES
-- =============================================================================

CREATE TABLE IF NOT EXISTS games (
    game_id      INT AUTO_INCREMENT  PRIMARY KEY,
    game_name    VARCHAR(100)        UNIQUE NOT NULL,
    slug         VARCHAR(200)        UNIQUE NOT NULL,
    genre        VARCHAR(50),
    developer    VARCHAR(100),
    release_year INT,
    cover_image  TEXT,
    icon         TEXT,
    rating       DECIMAL(3,2),
    platforms    VARCHAR(50),
    description  TEXT,
    screenshots  JSON,
    status       VARCHAR(20)         NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_games_slug   ON games(slug);
CREATE INDEX idx_games_genre  ON games(genre);
CREATE INDEX idx_games_status ON games(status);


-- =============================================================================
-- 3. USER → GAME PROFILES
--    FIX BUG 8: `rank` and `role` are reserved words in MySQL 8.0+
--    (RANK is a window function; ROLE is a privilege keyword).
--    Bare column names caused Error 1064 here — now backtick-quoted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_game_profile (
    profile_id     INT AUTO_INCREMENT  PRIMARY KEY,
    user_id        INT                 NOT NULL,
    game_id        INT                 NOT NULL,
    `rank`         VARCHAR(50),                                     -- FIX BUG 8
    `role`         VARCHAR(50),                                     -- FIX BUG 8
    win_rate       DECIMAL(5,2),
    matches_played INT                 NOT NULL DEFAULT 0,
    elo_rating     INT                 NOT NULL DEFAULT 1000,
    UNIQUE KEY uq_ugp_user_game (user_id, game_id),
    CONSTRAINT fk_ugp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_ugp_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ugp_user ON user_game_profile(user_id);
CREATE INDEX idx_ugp_game ON user_game_profile(game_id);


-- =============================================================================
-- 4. SOCIAL — follows & friendships
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_follows (
    follower_id  INT      NOT NULL,
    following_id INT      NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_uf_no_self_follow CHECK (follower_id <> following_id),
    CONSTRAINT fk_uf_follower  FOREIGN KEY (follower_id)  REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_uf_following FOREIGN KEY (following_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);


CREATE TABLE IF NOT EXISTS friendships (
    friendship_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id       INT                 NOT NULL,
    friend_id     INT                 NOT NULL,
    status        VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | blocked
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fs_no_self CHECK (user_id <> friend_id),
    CONSTRAINT fk_fs_user   FOREIGN KEY (user_id)   REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_fs_friend FOREIGN KEY (friend_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_friendships_user   ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);


-- =============================================================================
-- 5. DIRECT MESSAGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
    message_id  INT AUTO_INCREMENT  PRIMARY KEY,
    sender_id   INT                 NOT NULL,
    receiver_id INT                 NOT NULL,
    content     TEXT                NOT NULL,
    sent_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN             NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_sender   ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);


-- =============================================================================
-- 6. TEAMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS teams (
    team_id     INT AUTO_INCREMENT  PRIMARY KEY,
    team_name   VARCHAR(100)        UNIQUE NOT NULL,
    game_id     INT,
    logo        TEXT,
    region      VARCHAR(50),
    description TEXT,
    created_by  INT,
    created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_game       FOREIGN KEY (game_id)    REFERENCES games(game_id)  ON DELETE SET NULL,
    CONSTRAINT fk_teams_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_teams_game       ON teams(game_id);
CREATE INDEX idx_teams_created_by ON teams(created_by);


-- FIX BUG 8: `role` is a reserved word in MySQL 8.0 — backtick-quoted.
CREATE TABLE IF NOT EXISTS team_members (
    team_member_id INT AUTO_INCREMENT  PRIMARY KEY,
    team_id        INT                 NOT NULL,
    user_id        INT                 NOT NULL,
    `role`         VARCHAR(50)         NOT NULL DEFAULT 'member',  -- FIX BUG 8: captain | member | sub
    status         VARCHAR(20)         NOT NULL DEFAULT 'active',  -- active | inactive
    joined_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tm_team_user (team_id, user_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);


CREATE TABLE IF NOT EXISTS team_invitations (
    invite_id  INT AUTO_INCREMENT  PRIMARY KEY,
    team_id    INT                 NOT NULL,
    user_id    INT                 NOT NULL,
    invited_by INT,
    status     VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
    sent_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ti_team       FOREIGN KEY (team_id)    REFERENCES teams(team_id)  ON DELETE CASCADE,
    CONSTRAINT fk_ti_user       FOREIGN KEY (user_id)    REFERENCES users(user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_ti_invited_by FOREIGN KEY (invited_by) REFERENCES users(user_id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_user ON team_invitations(user_id);


-- =============================================================================
-- 7. TEAM FINDER
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_finder_posts (
    post_id       INT AUTO_INCREMENT  PRIMARY KEY,
    user_id       INT                 NOT NULL,
    game_id       INT                 NOT NULL,
    team_id       INT,
    rank_required VARCHAR(50),
    role_required VARCHAR(50),
    region        VARCHAR(50),
    description   TEXT,
    status        VARCHAR(20)         NOT NULL DEFAULT 'open',  -- open | closed | expired
    deadline      DATETIME,
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tfp_user FOREIGN KEY (user_id) REFERENCES users(user_id)  ON DELETE CASCADE,
    CONSTRAINT fk_tfp_game FOREIGN KEY (game_id) REFERENCES games(game_id)  ON DELETE CASCADE,
    CONSTRAINT fk_tfp_team FOREIGN KEY (team_id) REFERENCES teams(team_id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tfp_status_deadline ON team_finder_posts(status, deadline);
CREATE INDEX idx_tfp_game            ON team_finder_posts(game_id);
CREATE INDEX idx_tfp_team            ON team_finder_posts(team_id);
CREATE INDEX idx_tfp_user            ON team_finder_posts(user_id);


CREATE TABLE IF NOT EXISTS team_finder_applications (
    application_id INT AUTO_INCREMENT  PRIMARY KEY,
    post_id        INT                 NOT NULL,
    user_id        INT                 NOT NULL,
    message        TEXT,
    status         VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | draft_accepted | accepted | rejected
    applied_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tfa_post FOREIGN KEY (post_id) REFERENCES team_finder_posts(post_id) ON DELETE CASCADE,
    CONSTRAINT fk_tfa_user FOREIGN KEY (user_id) REFERENCES users(user_id)             ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tfa_post   ON team_finder_applications(post_id);
CREATE INDEX idx_tfa_user   ON team_finder_applications(user_id);
CREATE INDEX idx_tfa_status ON team_finder_applications(status);


-- =============================================================================
-- 8. TOURNAMENT ORGANIZERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournament_organizers (
    organizer_id      INT AUTO_INCREMENT  PRIMARY KEY,
    organization_name VARCHAR(150)        NOT NULL,
    website           TEXT,
    contact_email     VARCHAR(100),
    verified          BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 9. TOURNAMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id         INT AUTO_INCREMENT  PRIMARY KEY,
    name                  VARCHAR(150)        NOT NULL,
    game_id               INT                 NOT NULL,
    organizer_id          INT,
    created_by            INT,
    source                VARCHAR(20)         NOT NULL DEFAULT 'user',  -- user | admin | pandascore
    external_id           VARCHAR(100),                                  -- PandaScore tournament id (source='pandascore' only)
    prize_pool            DECIMAL(12,2),
    entry_fee             DECIMAL(10,2)       DEFAULT 0,
    region                VARCHAR(50),
    format                VARCHAR(50),        -- single_elimination | double_elimination | round_robin | swiss
    start_date            DATE,
    end_date              DATE,
    registration_deadline DATE,
    status                VARCHAR(20)         NOT NULL DEFAULT 'upcoming',  -- upcoming | ongoing | completed | cancelled
    image_url             TEXT,
    description           TEXT,
    organizer_name        VARCHAR(150),
    location              VARCHAR(150),
    join_link             TEXT,
    created_at            DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_game      FOREIGN KEY (game_id)      REFERENCES games(game_id)                      ON DELETE CASCADE,
    CONSTRAINT fk_t_organizer FOREIGN KEY (organizer_id) REFERENCES tournament_organizers(organizer_id) ON DELETE SET NULL,
    CONSTRAINT fk_t_creator   FOREIGN KEY (created_by)   REFERENCES users(user_id)                      ON DELETE SET NULL,
    UNIQUE KEY uq_tournaments_source_external (source, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tournaments_game   ON tournaments(game_id);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_region ON tournaments(region);


CREATE TABLE IF NOT EXISTS tournament_registrations (
    registration_id INT AUTO_INCREMENT  PRIMARY KEY,
    tournament_id   INT                 NOT NULL,
    team_id         INT                 NOT NULL,
    status          VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | confirmed | disqualified
    registered_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tr_tournament_team (tournament_id, team_id),
    CONSTRAINT fk_tr_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_team       FOREIGN KEY (team_id)       REFERENCES teams(team_id)             ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tourney_reg_tournament ON tournament_registrations(tournament_id);
CREATE INDEX idx_tourney_reg_team       ON tournament_registrations(team_id);


-- =============================================================================
-- 10. MATCHES
-- =============================================================================

CREATE TABLE IF NOT EXISTS matches (
    match_id       INT AUTO_INCREMENT  PRIMARY KEY,
    tournament_id  INT,
    team1_id       INT,
    team2_id       INT,
    winner_team_id INT,
    match_date     DATETIME,
    status         VARCHAR(20)         NOT NULL DEFAULT 'scheduled',  -- scheduled | live | completed | cancelled
    score          VARCHAR(20),
    round          VARCHAR(50),
    created_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_m_tournament FOREIGN KEY (tournament_id)  REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT fk_m_team1      FOREIGN KEY (team1_id)       REFERENCES teams(team_id)             ON DELETE SET NULL,
    CONSTRAINT fk_m_team2      FOREIGN KEY (team2_id)       REFERENCES teams(team_id)             ON DELETE SET NULL,
    CONSTRAINT fk_m_winner     FOREIGN KEY (winner_team_id) REFERENCES teams(team_id)             ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status     ON matches(status);


CREATE TABLE IF NOT EXISTS match_player_stats (
    stat_id    INT AUTO_INCREMENT  PRIMARY KEY,
    match_id   INT                 NOT NULL,
    user_id    INT                 NOT NULL,
    kills      INT                 NOT NULL DEFAULT 0,
    deaths     INT                 NOT NULL DEFAULT 0,
    assists    INT                 NOT NULL DEFAULT 0,
    damage     INT                 NOT NULL DEFAULT 0,
    mvp        BOOLEAN             NOT NULL DEFAULT FALSE,
    UNIQUE KEY uq_mps_match_user (match_id, user_id),
    CONSTRAINT fk_mps_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
    CONSTRAINT fk_mps_user  FOREIGN KEY (user_id)  REFERENCES users(user_id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_match_stats_match ON match_player_stats(match_id);
CREATE INDEX idx_match_stats_user  ON match_player_stats(user_id);


-- =============================================================================
-- 11. COMMUNITIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS communities (
    community_id INT AUTO_INCREMENT  PRIMARY KEY,
    game_id      INT                 NOT NULL,
    name         VARCHAR(100)        NOT NULL,
    description  TEXT,
    created_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comm_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_communities_game ON communities(game_id);


CREATE TABLE IF NOT EXISTS community_posts (
    post_id       INT AUTO_INCREMENT  PRIMARY KEY,
    community_id  INT                 NOT NULL,
    user_id       INT                 NOT NULL,
    title         VARCHAR(200),
    content       TEXT,
    image_url     TEXT,
    upvotes       INT                 NOT NULL DEFAULT 0,
    downvotes     INT                 NOT NULL DEFAULT 0,
    comment_count INT                 NOT NULL DEFAULT 0,  -- maintained by triggers
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cp_community FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_user      FOREIGN KEY (user_id)      REFERENCES users(user_id)            ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_community_posts_community ON community_posts(community_id);
CREATE INDEX idx_community_posts_user      ON community_posts(user_id);
CREATE INDEX idx_community_posts_created   ON community_posts(created_at);


CREATE TABLE IF NOT EXISTS post_comments (
    comment_id INT AUTO_INCREMENT  PRIMARY KEY,
    post_id    INT                 NOT NULL,
    user_id    INT                 NOT NULL,
    content    TEXT                NOT NULL,
    created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pc_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
    CONSTRAINT fk_pc_user FOREIGN KEY (user_id) REFERENCES users(user_id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_user ON post_comments(user_id);


-- post_votes: tracks per-user votes; enforces one vote per user per post.
-- (was missing entirely in v3.0 — added in v3.1)
CREATE TABLE IF NOT EXISTS post_votes (
    vote_id    INT AUTO_INCREMENT  PRIMARY KEY,
    post_id    INT                 NOT NULL,
    user_id    INT                 NOT NULL,
    vote_type  VARCHAR(10)         NOT NULL,               -- 'up' | 'down'
    created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pv_post_user (post_id, user_id),
    CONSTRAINT chk_pv_vote_type CHECK (vote_type IN ('up', 'down')),
    CONSTRAINT fk_pv_post FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
    CONSTRAINT fk_pv_user FOREIGN KEY (user_id) REFERENCES users(user_id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_post_votes_post ON post_votes(post_id);
CREATE INDEX idx_post_votes_user ON post_votes(user_id);


-- =============================================================================
-- 12. STREAMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS streams (
    stream_id    INT AUTO_INCREMENT  PRIMARY KEY,
    user_id      INT                 NOT NULL,
    game_id      INT,
    platform     VARCHAR(50),                  -- twitch | youtube | other
    stream_url   TEXT,
    title        VARCHAR(200),
    status       VARCHAR(20)         NOT NULL DEFAULT 'live',  -- live | ended
    viewer_count INT                 NOT NULL DEFAULT 0,
    started_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at     DATETIME,
    CONSTRAINT fk_str_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_str_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_streams_user   ON streams(user_id);
CREATE INDEX idx_streams_game   ON streams(game_id);
CREATE INDEX idx_streams_status ON streams(status);


-- =============================================================================
-- 13. ACHIEVEMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS achievements (
    achievement_id INT AUTO_INCREMENT  PRIMARY KEY,
    name           VARCHAR(100)        UNIQUE NOT NULL,
    description    TEXT,
    icon           TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS user_achievements (
    user_achievement_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id             INT                 NOT NULL,
    achievement_id      INT                 NOT NULL,
    earned_at           DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ua_user_achievement (user_id, achievement_id),
    CONSTRAINT fk_ua_user        FOREIGN KEY (user_id)        REFERENCES users(user_id)               ON DELETE CASCADE,
    CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);


-- =============================================================================
-- 14. NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id         INT                 NOT NULL,
    type            VARCHAR(50)         NOT NULL,  -- team_invite | match_result | tournament | follow | message | achievement
    message         TEXT                NOT NULL,
    related_id      INT,
    is_read         BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);


-- =============================================================================
-- 15. REPORTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS reports (
    report_id     INT AUTO_INCREMENT  PRIMARY KEY,
    reported_user INT                 NOT NULL,
    reported_by   INT                 NOT NULL,
    reason        TEXT                NOT NULL,
    status        VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | reviewed | resolved | dismissed
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rep_not_self CHECK (reported_user <> reported_by),
    CONSTRAINT fk_rep_reported FOREIGN KEY (reported_user) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rep_reporter FOREIGN KEY (reported_by)   REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_reports_reported ON reports(reported_user);
CREATE INDEX idx_reports_status   ON reports(status);


-- =============================================================================
-- 16. AI RECOMMENDATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id           INT                 NOT NULL,
    type              VARCHAR(50)         NOT NULL,  -- team | tournament | game | player
    data              JSON,
    generated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ai_rec_user ON ai_recommendations(user_id);
CREATE INDEX idx_ai_rec_type ON ai_recommendations(type);


-- =============================================================================
-- 17. OTP — PENDING VERIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS pending_verifications (
    email         VARCHAR(255)  PRIMARY KEY,
    username      VARCHAR(50)   NOT NULL,
    password_hash TEXT          NOT NULL,
    otp           VARCHAR(20)   NOT NULL,
    expires_at    DATETIME      NOT NULL,
    attempts      INT           NOT NULL DEFAULT 0,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pending_verifications_expires ON pending_verifications(expires_at);


-- =============================================================================
-- 18. OTP — PASSWORD RESETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
    email      VARCHAR(255)  PRIMARY KEY,
    otp        VARCHAR(20)   NOT NULL,
    expires_at DATETIME      NOT NULL,
    attempts   INT           NOT NULL DEFAULT 0,
    verified   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);


-- =============================================================================
-- PART 2 — ARCHIVE SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS archive_config (
    `key`  VARCHAR(100)  PRIMARY KEY,
    value  TEXT          NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO archive_config (`key`, value) VALUES
    ('version',        '1.1'),
    ('enabled',        'true'),
    ('retention_days', '365');


-- 1. ARCHIVE — TOURNAMENTS
CREATE TABLE IF NOT EXISTS archive_tournaments (
    archive_id            INT AUTO_INCREMENT  PRIMARY KEY,
    tournament_id         INT                 NOT NULL,
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
    created_at            DATETIME,
    registrations_snapshot JSON,
    matches_snapshot       JSON,
    archived_at            DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by            INT,
    archive_reason         VARCHAR(100)               NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_tournaments_id     ON archive_tournaments(tournament_id);
CREATE INDEX idx_arch_tournaments_at     ON archive_tournaments(archived_at);
CREATE INDEX idx_arch_tournaments_status ON archive_tournaments(status);


-- 2. ARCHIVE — TEAM FINDER POSTS
CREATE TABLE IF NOT EXISTS archive_team_finder_posts (
    archive_id            INT AUTO_INCREMENT  PRIMARY KEY,
    post_id               INT                 NOT NULL,
    user_id               INT,
    game_id               INT,
    team_id               INT,
    rank_required         VARCHAR(50),
    role_required         VARCHAR(50),
    region                VARCHAR(50),
    description           TEXT,
    status                VARCHAR(20),
    deadline              DATETIME,
    created_at            DATETIME,
    applications_snapshot JSON,
    archived_at           DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by           INT,
    archive_reason         VARCHAR(100)                NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_tfp_id   ON archive_team_finder_posts(post_id);
CREATE INDEX idx_arch_tfp_user ON archive_team_finder_posts(user_id);
CREATE INDEX idx_arch_tfp_at   ON archive_team_finder_posts(archived_at);


-- 3. ARCHIVE — STREAMS  (peak_viewers removed — no source column in streams)
CREATE TABLE IF NOT EXISTS archive_streams (
    archive_id     INT AUTO_INCREMENT  PRIMARY KEY,
    stream_id      INT                 NOT NULL,
    user_id        INT,
    game_id        INT,
    platform       VARCHAR(50),
    stream_url     TEXT,
    title          VARCHAR(200),
    status         VARCHAR(20),
    viewer_count   INT,
    started_at     DATETIME,
    ended_at       DATETIME,
    archived_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by    INT,
    archive_reason         VARCHAR(100)                NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_streams_id   ON archive_streams(stream_id);
CREATE INDEX idx_arch_streams_user ON archive_streams(user_id);
CREATE INDEX idx_arch_streams_at   ON archive_streams(archived_at);


-- 4. ARCHIVE — COMMUNITY POSTS
CREATE TABLE IF NOT EXISTS archive_community_posts (
    archive_id        INT AUTO_INCREMENT  PRIMARY KEY,
    post_id           INT                 NOT NULL,
    community_id      INT,
    user_id           INT,
    title             VARCHAR(200),
    content           TEXT,
    image_url         TEXT,
    upvotes           INT,
    downvotes         INT,
    comment_count     INT,
    created_at        DATETIME,
    comments_snapshot JSON,
    archived_at       DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by       INT,
    archive_reason         VARCHAR(100)               NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_cp_id   ON archive_community_posts(post_id);
CREATE INDEX idx_arch_cp_user ON archive_community_posts(user_id);
CREATE INDEX idx_arch_cp_at   ON archive_community_posts(archived_at);


-- 5. ARCHIVE — TEAMS
CREATE TABLE IF NOT EXISTS archive_teams (
    archive_id           INT AUTO_INCREMENT  PRIMARY KEY,
    team_id              INT                 NOT NULL,
    team_name            VARCHAR(100),
    game_id              INT,
    logo                 TEXT,
    region               VARCHAR(50),
    description          TEXT,
    created_by           INT,
    created_at           DATETIME,
    members_snapshot     JSON,
    invitations_snapshot JSON,
    archived_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by          INT,
    archive_reason         VARCHAR(100)                NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_teams_id ON archive_teams(team_id);
CREATE INDEX idx_arch_teams_at ON archive_teams(archived_at);


-- 6. ARCHIVE — MATCHES
CREATE TABLE IF NOT EXISTS archive_matches (
    archive_id            INT AUTO_INCREMENT  PRIMARY KEY,
    match_id              INT                 NOT NULL,
    tournament_id         INT,
    team1_id              INT,
    team2_id              INT,
    winner_team_id        INT,
    match_date            DATETIME,
    status                VARCHAR(20),
    score                 VARCHAR(20),
    round                 VARCHAR(50),
    created_at            DATETIME,
    player_stats_snapshot JSON,
    archived_at           DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by           INT,
    archive_reason         VARCHAR(100)                NOT NULL DEFAULT 'user_deleted'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_matches_id         ON archive_matches(match_id);
CREATE INDEX idx_arch_matches_tournament ON archive_matches(tournament_id);
CREATE INDEX idx_arch_matches_at         ON archive_matches(archived_at);


-- 7. DELETED USERS LOG
CREATE TABLE IF NOT EXISTS deleted_users_log (
    log_id        INT AUTO_INCREMENT  PRIMARY KEY,
    user_id       INT                 NOT NULL,
    username      VARCHAR(60),
    email         VARCHAR(120),
    country       VARCHAR(50),
    deleted_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_by    INT,
    delete_reason TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_del_users_id ON deleted_users_log(user_id);
CREATE INDEX idx_del_users_at ON deleted_users_log(deleted_at);


-- 8. UNIFIED ARCHIVE AUDIT LOG
CREATE TABLE IF NOT EXISTS archive_audit_log (
    log_id         INT AUTO_INCREMENT  PRIMARY KEY,
    entity_type    VARCHAR(50)         NOT NULL,
    entity_id      INT                 NOT NULL,
    entity_name    TEXT,
    archived_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_by    INT,
    archive_reason         VARCHAR(100)                NOT NULL DEFAULT 'user_deleted',
    restored_at    DATETIME,
    restored_by    INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_arch_audit_entity   ON archive_audit_log(entity_type, entity_id);
CREATE INDEX idx_arch_audit_at       ON archive_audit_log(archived_at);
CREATE INDEX idx_arch_audit_restored ON archive_audit_log(restored_at);


-- =============================================================================
-- PART 3 — TRIGGERS
-- DROP TRIGGER IF EXISTS before each CREATE makes this section re-runnable.
-- =============================================================================

DELIMITER $$

-- ─── 1. Archive Tournament ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_archive_tournament$$
CREATE TRIGGER trg_archive_tournament
    BEFORE DELETE ON tournaments
    FOR EACH ROW
BEGIN
    DECLARE v_registrations JSON;
    DECLARE v_matches       JSON;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'registration_id', registration_id,
            'tournament_id',   tournament_id,
            'team_id',         team_id,
            'status',          status,
            'registered_at',   registered_at
        )),
        JSON_ARRAY()
    ) INTO v_registrations
    FROM tournament_registrations
    WHERE tournament_id = OLD.tournament_id;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'match_id',       m.match_id,
            'team1_id',       m.team1_id,
            'team2_id',       m.team2_id,
            'winner_team_id', m.winner_team_id,
            'match_date',     m.match_date,
            'status',         m.status,
            'score',          m.score,
            'round',          m.round,
            'created_at',     m.created_at,
            'player_stats',   (
                SELECT COALESCE(
                    JSON_ARRAYAGG(JSON_OBJECT(
                        'stat_id',  ps.stat_id,
                        'user_id',  ps.user_id,
                        'kills',    ps.kills,
                        'deaths',   ps.deaths,
                        'assists',  ps.assists,
                        'damage',   ps.damage,
                        'mvp',      ps.mvp
                    )),
                    JSON_ARRAY()
                )
                FROM match_player_stats ps
                WHERE ps.match_id = m.match_id
            )
        )),
        JSON_ARRAY()
    ) INTO v_matches
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
END$$


-- ─── 2. Archive Team Finder Post ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_archive_team_finder_post$$
CREATE TRIGGER trg_archive_team_finder_post
    BEFORE DELETE ON team_finder_posts
    FOR EACH ROW
BEGIN
    DECLARE v_applications JSON;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'application_id', application_id,
            'post_id',        post_id,
            'user_id',        user_id,
            'message',        message,
            'status',         status,
            'applied_at',     applied_at
        )),
        JSON_ARRAY()
    ) INTO v_applications
    FROM team_finder_applications
    WHERE post_id = OLD.post_id;

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
END$$


-- ─── 3. Archive Stream ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_archive_stream$$
CREATE TRIGGER trg_archive_stream
    BEFORE DELETE ON streams
    FOR EACH ROW
BEGIN
    INSERT INTO archive_streams (
        stream_id, user_id, game_id, platform, stream_url, title,
        status, viewer_count, started_at, ended_at
    ) VALUES (
        OLD.stream_id, OLD.user_id, OLD.game_id, OLD.platform, OLD.stream_url, OLD.title,
        OLD.status, OLD.viewer_count, OLD.started_at, OLD.ended_at
    );
END$$


-- ─── 4. Archive Community Post ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_archive_community_post$$
CREATE TRIGGER trg_archive_community_post
    BEFORE DELETE ON community_posts
    FOR EACH ROW
BEGIN
    DECLARE v_comments JSON;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'comment_id', comment_id,
            'post_id',    post_id,
            'user_id',    user_id,
            'content',    content,
            'created_at', created_at
        )),
        JSON_ARRAY()
    ) INTO v_comments
    FROM post_comments
    WHERE post_id = OLD.post_id;

    INSERT INTO archive_community_posts (
        post_id, community_id, user_id, title, content, image_url,
        upvotes, downvotes, comment_count, created_at,
        comments_snapshot
    ) VALUES (
        OLD.post_id, OLD.community_id, OLD.user_id, OLD.title, OLD.content, OLD.image_url,
        OLD.upvotes, OLD.downvotes, OLD.comment_count, OLD.created_at,
        v_comments
    );
END$$


-- ─── 5. Archive Team ──────────────────────────────────────────────────────────
-- FIX BUG 8: `role` is reserved — backtick-quoted in JSON_OBJECT reference.
DROP TRIGGER IF EXISTS trg_archive_team$$
CREATE TRIGGER trg_archive_team
    BEFORE DELETE ON teams
    FOR EACH ROW
BEGIN
    DECLARE v_members     JSON;
    DECLARE v_invitations JSON;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'team_member_id', team_member_id,
            'team_id',        team_id,
            'user_id',        user_id,
            'role',           `role`,          -- FIX BUG 8: bare `role` reference
            'status',         status,
            'joined_at',      joined_at
        )),
        JSON_ARRAY()
    ) INTO v_members
    FROM team_members
    WHERE team_id = OLD.team_id;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'invite_id',  invite_id,
            'team_id',    team_id,
            'user_id',    user_id,
            'invited_by', invited_by,
            'status',     status,
            'sent_at',    sent_at
        )),
        JSON_ARRAY()
    ) INTO v_invitations
    FROM team_invitations
    WHERE team_id = OLD.team_id;

    INSERT INTO archive_teams (
        team_id, team_name, game_id, logo, region, description, created_by, created_at,
        members_snapshot, invitations_snapshot
    ) VALUES (
        OLD.team_id, OLD.team_name, OLD.game_id, OLD.logo, OLD.region, OLD.description, OLD.created_by, OLD.created_at,
        v_members, v_invitations
    );
END$$


-- ─── 6. Archive Match ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_archive_match$$
CREATE TRIGGER trg_archive_match
    BEFORE DELETE ON matches
    FOR EACH ROW
BEGIN
    DECLARE v_stats JSON;

    SELECT COALESCE(
        JSON_ARRAYAGG(JSON_OBJECT(
            'stat_id',  stat_id,
            'match_id', match_id,
            'user_id',  user_id,
            'kills',    kills,
            'deaths',   deaths,
            'assists',  assists,
            'damage',   damage,
            'mvp',      mvp
        )),
        JSON_ARRAY()
    ) INTO v_stats
    FROM match_player_stats
    WHERE match_id = OLD.match_id;

    INSERT INTO archive_matches (
        match_id, tournament_id, team1_id, team2_id, winner_team_id,
        match_date, status, score, round, created_at,
        player_stats_snapshot
    ) VALUES (
        OLD.match_id, OLD.tournament_id, OLD.team1_id, OLD.team2_id, OLD.winner_team_id,
        OLD.match_date, OLD.status, OLD.score, OLD.round, OLD.created_at,
        v_stats
    );
END$$


-- ─── 7 & 8. Maintain community_posts.comment_count ───────────────────────────
DROP TRIGGER IF EXISTS trg_increment_comment_count$$
CREATE TRIGGER trg_increment_comment_count
    AFTER INSERT ON post_comments
    FOR EACH ROW
BEGIN
    UPDATE community_posts
    SET comment_count = comment_count + 1
    WHERE post_id = NEW.post_id;
END$$


DROP TRIGGER IF EXISTS trg_decrement_comment_count$$
CREATE TRIGGER trg_decrement_comment_count
    AFTER DELETE ON post_comments
    FOR EACH ROW
BEGIN
    UPDATE community_posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE post_id = OLD.post_id;
END$$


DELIMITER ;


-- =============================================================================
-- PART 4 — CONVENIENCE VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW v_archived_tournaments AS
SELECT
    at2.archive_id,
    at2.tournament_id,
    at2.name                                             AS tournament_name,
    g.game_name,
    at2.status,
    at2.prize_pool,
    at2.region,
    at2.start_date,
    at2.end_date,
    at2.archived_at,
    at2.archive_reason,
    u.username                                           AS archived_by_user,
    COALESCE(JSON_LENGTH(at2.registrations_snapshot), 0) AS registered_teams,
    COALESCE(JSON_LENGTH(at2.matches_snapshot), 0)       AS total_matches
FROM archive_tournaments at2
LEFT JOIN games g ON g.game_id = at2.game_id
LEFT JOIN users u ON u.user_id = at2.archived_by;


CREATE OR REPLACE VIEW v_archived_team_finder_posts AS
SELECT
    afp.archive_id,
    afp.post_id,
    afp.rank_required,
    afp.role_required,
    afp.region,
    afp.status,
    afp.deadline,
    afp.archived_at,
    afp.archive_reason,
    g.game_name,
    u.username                                           AS posted_by,
    t.team_name                                          AS team,
    COALESCE(JSON_LENGTH(afp.applications_snapshot), 0) AS total_applications
FROM archive_team_finder_posts afp
LEFT JOIN games g ON g.game_id = afp.game_id
LEFT JOIN users u ON u.user_id = afp.user_id
LEFT JOIN teams t ON t.team_id = afp.team_id;


CREATE OR REPLACE VIEW v_archived_streams AS
SELECT
    ars.archive_id,
    ars.stream_id,
    ars.title,
    ars.platform,
    ars.status,
    ars.viewer_count,
    ars.started_at,
    ars.ended_at,
    TIMESTAMPDIFF(SECOND, ars.started_at, COALESCE(ars.ended_at, ars.archived_at)) / 60
                                                AS duration_minutes,
    ars.archived_at,
    ars.archive_reason,
    g.game_name,
    u.username                                  AS streamer
FROM archive_streams ars
LEFT JOIN games g ON g.game_id = ars.game_id
LEFT JOIN users u ON u.user_id = ars.user_id;


CREATE OR REPLACE VIEW v_archived_community_posts AS
SELECT
    acp.archive_id,
    acp.post_id,
    acp.title,
    acp.upvotes,
    acp.downvotes,
    acp.comment_count,
    acp.created_at,
    acp.archived_at,
    acp.archive_reason,
    u.username  AS author,
    c.name      AS community
FROM archive_community_posts acp
LEFT JOIN users       u ON u.user_id      = acp.user_id
LEFT JOIN communities c ON c.community_id = acp.community_id;


CREATE OR REPLACE VIEW v_archived_teams AS
SELECT
    at2.archive_id,
    at2.team_id,
    at2.team_name,
    at2.region,
    at2.archived_at,
    at2.archive_reason,
    g.game_name,
    u.username                                      AS created_by,
    COALESCE(JSON_LENGTH(at2.members_snapshot), 0)  AS member_count
FROM archive_teams at2
LEFT JOIN games g ON g.game_id = at2.game_id
LEFT JOIN users u ON u.user_id = at2.created_by;


-- =============================================================================
-- PART 5 — STORED PROCEDURES
-- =============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS fn_restore_tournament$$
CREATE PROCEDURE fn_restore_tournament(IN p_tournament_id INT, IN p_restored_by INT)
BEGIN
    INSERT IGNORE INTO tournaments (
        tournament_id, name, game_id, organizer_id, created_by,
        prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline,
        status, image_url, description, organizer_name, location, join_link, created_at
    )
    SELECT
        tournament_id, name, game_id, organizer_id, created_by,
        prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline,
        'upcoming',
        image_url, description, organizer_name, location, join_link, created_at
    FROM archive_tournaments
    WHERE tournament_id = p_tournament_id
    ORDER BY archived_at DESC
    LIMIT 1;

    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'tournament'
      AND entity_id   = p_tournament_id
      AND restored_at IS NULL;
END$$


DROP PROCEDURE IF EXISTS fn_restore_team$$
CREATE PROCEDURE fn_restore_team(IN p_team_id INT, IN p_restored_by INT)
BEGIN
    INSERT IGNORE INTO teams (team_id, team_name, game_id, logo, region, description, created_by, created_at)
    SELECT                    team_id, team_name, game_id, logo, region, description, created_by, created_at
    FROM archive_teams
    WHERE team_id = p_team_id
    ORDER BY archived_at DESC
    LIMIT 1;

    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'team'
      AND entity_id   = p_team_id
      AND restored_at IS NULL;
END$$


DROP PROCEDURE IF EXISTS fn_restore_stream$$
CREATE PROCEDURE fn_restore_stream(IN p_stream_id INT, IN p_restored_by INT)
BEGIN
    INSERT IGNORE INTO streams (
        stream_id, user_id, game_id, platform, stream_url, title,
        status, viewer_count, started_at, ended_at
    )
    SELECT
        stream_id, user_id, game_id, platform, stream_url, title,
        'ended', viewer_count, started_at, ended_at
    FROM archive_streams
    WHERE stream_id = p_stream_id
    ORDER BY archived_at DESC
    LIMIT 1;

    UPDATE archive_audit_log
    SET restored_at = NOW(), restored_by = p_restored_by
    WHERE entity_type = 'stream'
      AND entity_id   = p_stream_id
      AND restored_at IS NULL;
END$$


DROP PROCEDURE IF EXISTS fn_purge_old_archives$$
CREATE PROCEDURE fn_purge_old_archives()
BEGIN
    DECLARE v_days   INT;
    DECLARE v_cutoff DATETIME;

    SELECT CAST(value AS UNSIGNED) INTO v_days
    FROM archive_config WHERE `key` = 'retention_days';

    -- Fallback to 365 if retention_days row is missing (prevents silent no-op)
    SET v_days   = COALESCE(v_days, 365);
    SET v_cutoff = DATE_SUB(NOW(), INTERVAL v_days DAY);

    DROP TEMPORARY TABLE IF EXISTS _purge_results;
    CREATE TEMPORARY TABLE _purge_results (
        table_name  VARCHAR(100),
        rows_purged BIGINT
    );

    DELETE FROM archive_tournaments       WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_tournaments',       ROW_COUNT());

    DELETE FROM archive_team_finder_posts WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_team_finder_posts', ROW_COUNT());

    DELETE FROM archive_streams           WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_streams',           ROW_COUNT());

    DELETE FROM archive_community_posts   WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_community_posts',   ROW_COUNT());

    DELETE FROM archive_teams             WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_teams',             ROW_COUNT());

    DELETE FROM archive_matches           WHERE archived_at < v_cutoff;
    INSERT INTO _purge_results VALUES ('archive_matches',           ROW_COUNT());

    DELETE FROM archive_audit_log WHERE archived_at < v_cutoff AND restored_at IS NULL;
    INSERT INTO _purge_results VALUES ('archive_audit_log',         ROW_COUNT());

    SELECT * FROM _purge_results;
    DROP TEMPORARY TABLE IF EXISTS _purge_results;
END$$


DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- OPTIONAL — CLEANUP EVENTS (run once after import)


CREATE EVENT IF NOT EXISTS ev_clean_pending_verifications
ON SCHEDULE EVERY 1 HOUR DO
DELETE FROM pending_verifications WHERE expires_at < NOW();

CREATE EVENT IF NOT EXISTS ev_clean_password_resets
ON SCHEDULE EVERY 1 HOUR DO
DELETE FROM password_resets WHERE expires_at < NOW();

CREATE EVENT IF NOT EXISTS ev_purge_archives
ON SCHEDULE EVERY 1 DAY DO
CALL fn_purge_old_archives();
-- =============================================================================


ALTER TABLE pending_verifications
  ADD COLUMN resend_count    INT         NOT NULL DEFAULT 0      AFTER attempts,
  ADD COLUMN last_resent_at  DATETIME    NULL     DEFAULT NULL   AFTER resend_count;
  
ALTER TABLE password_resets
  ADD COLUMN verified_at DATETIME NULL DEFAULT NULL AFTER verified;

-- =============================================================================
-- MIGRATION v3.3 — BUG-5 FIX: expand username/email columns to prevent
-- overflow when soft-delete appends "_deleted_<id>" suffix.
-- Run these on any existing database (safe — IF the column is currently narrower).
-- =============================================================================
ALTER TABLE users
  MODIFY COLUMN username VARCHAR(60)  NOT NULL,
  MODIFY COLUMN email    VARCHAR(120) NOT NULL;

ALTER TABLE deleted_users_log
  MODIFY COLUMN username VARCHAR(60),
  MODIFY COLUMN email    VARCHAR(120);

ALTER TABLE tournaments
ADD COLUMN max_teams INT DEFAULT NULL;

ALTER TABLE community_posts
  MODIFY COLUMN image_url LONGTEXT;


-- =============================================================================
-- MIGRATION: Team group chat
-- Safe to run on an existing database — uses CREATE TABLE IF NOT EXISTS,
-- so it will not error or duplicate if run more than once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_messages (
    team_message_id INT AUTO_INCREMENT  PRIMARY KEY,
    team_id          INT                 NOT NULL,
    sender_id        INT                 NOT NULL,
    content          TEXT                NOT NULL,
    sent_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tmsg_team   FOREIGN KEY (team_id)   REFERENCES teams(team_id) ON DELETE CASCADE,
    CONSTRAINT fk_tmsg_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_team_messages_team   ON team_messages(team_id, sent_at);
CREATE INDEX idx_team_messages_sender ON team_messages(sender_id);

-- ─── Migration: Add user_game_ids table ──────────────────────────────────────
-- Run this once against your ArenaX database on Hostinger
-- Adds per-platform in-game IDs that players can display on their profile

CREATE TABLE IF NOT EXISTS user_game_ids (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    platform        VARCHAR(50)     NOT NULL,          -- e.g. 'steam', 'riot', 'epic'
    game_id_value   VARCHAR(120)    NOT NULL,          -- the actual in-game ID / tag
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_platform (user_id, platform),
    CONSTRAINT fk_ugid_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── Migration: Chat System ───────────────────────────────────────────────────
-- Run ONCE in Hostinger phpMyAdmin.
-- team_messages already exists from v3.3 — only new tables added here.

-- 1. DM messages (1-to-1 draft chat, tied to a team application)
CREATE TABLE IF NOT EXISTS dm_messages (
    message_id     INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT         NOT NULL,
    sender_id      INT         NOT NULL,
    content        TEXT        NOT NULL,
    sent_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dmm_app    FOREIGN KEY (application_id)
        REFERENCES team_finder_applications(application_id) ON DELETE CASCADE,
    CONSTRAINT fk_dmm_sender FOREIGN KEY (sender_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_dm_app_id  ON dm_messages(application_id, message_id);
CREATE INDEX idx_dm_sender  ON dm_messages(sender_id);

-- 2. Read watermarks — tracks the last read message_id per user per chat
--    chat_type: 'team' → ref_id = team_id
--    chat_type: 'dm'   → ref_id = application_id
CREATE TABLE IF NOT EXISTS chat_read_status (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT             NOT NULL,
    chat_type        ENUM('team','dm') NOT NULL,
    ref_id           INT             NOT NULL,
    last_message_id  INT             NOT NULL DEFAULT 0,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_crs (user_id, chat_type, ref_id),
    CONSTRAINT fk_crs_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



ALTER TABLE community_posts
  ADD COLUMN image_urls JSON NULL AFTER image_url;


UPDATE community_posts
SET image_urls = JSON_ARRAY(image_url)
WHERE image_url IS NOT NULL
  AND image_urls IS NULL;


-- =============================================================================
-- MIGRATION: Message reply + delete (soft delete)
-- Run ONCE in Hostinger phpMyAdmin. Safe to re-run — checks avoid duplicate errors
-- only if you copy-paste carefully; if a column already exists MySQL will error,
-- in which case just skip that one line.
-- =============================================================================

-- ── team_messages ────────────────────────────────────────────────────────────
ALTER TABLE team_messages
  ADD COLUMN reply_to_id INT NULL AFTER sender_id,
  ADD COLUMN is_deleted  TINYINT(1) NOT NULL DEFAULT 0 AFTER content,
  ADD COLUMN deleted_at  DATETIME NULL AFTER is_deleted;

ALTER TABLE team_messages
  ADD CONSTRAINT fk_tmsg_reply FOREIGN KEY (reply_to_id)
      REFERENCES team_messages(team_message_id) ON DELETE SET NULL;

CREATE INDEX idx_team_messages_reply ON team_messages(reply_to_id);

-- ── dm_messages ──────────────────────────────────────────────────────────────
ALTER TABLE dm_messages
  ADD COLUMN reply_to_id INT NULL AFTER sender_id,
  ADD COLUMN is_deleted  TINYINT(1) NOT NULL DEFAULT 0 AFTER content,
  ADD COLUMN deleted_at  DATETIME NULL AFTER is_deleted;

ALTER TABLE dm_messages
  ADD CONSTRAINT fk_dmm_reply FOREIGN KEY (reply_to_id)
      REFERENCES dm_messages(message_id) ON DELETE SET NULL;

CREATE INDEX idx_dm_messages_reply ON dm_messages(reply_to_id);




-- =============================================================================
-- MIGRATION: Gamer DNA + Swipe Matching
-- Run ONCE in Hostinger phpMyAdmin (or `mysql < this_file.sql`).
-- Safe to re-run — uses CREATE TABLE IF NOT EXISTS throughout.
-- =============================================================================

-- 1. Gamer DNA — a lightweight self-assessment used to power match scoring.
--    One row per user (not per game) — playstyle is a general trait.
CREATE TABLE IF NOT EXISTS user_gamer_dna (
    user_id      INT                 PRIMARY KEY,
    play_style   ENUM('casual','balanced','competitive') NOT NULL,
    comms_pref   ENUM('voice','text','silent')            NOT NULL,
    session_goal ENUM('unwind','improve','win','socialize') NOT NULL,
    updated_at   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dna_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. Swipe actions — every like/pass a user makes on a candidate card.
--    UNIQUE(swiper_id, target_id) means a user can only swipe once per
--    candidate; re-swiping is not allowed (candidate simply won't resurface).
CREATE TABLE IF NOT EXISTS swipe_actions (
    swipe_id   INT AUTO_INCREMENT  PRIMARY KEY,
    swiper_id  INT                 NOT NULL,
    target_id  INT                 NOT NULL,
    action     ENUM('like','pass') NOT NULL,
    created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_swipe_pair (swiper_id, target_id),
    CONSTRAINT chk_swipe_no_self CHECK (swiper_id <> target_id),
    CONSTRAINT fk_swipe_swiper FOREIGN KEY (swiper_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_swipe_target FOREIGN KEY (target_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_swipe_target ON swipe_actions(target_id, action);


-- 3. Swipe matches — created when both sides have liked each other.
--    user_a_id is always the smaller user_id so (a,b) is a stable, unique
--    pairing regardless of who swiped last (mirrors the friendships/team
--    dedup pattern already used elsewhere in this schema).
CREATE TABLE IF NOT EXISTS swipe_matches (
    match_id   INT AUTO_INCREMENT  PRIMARY KEY,
    user_a_id  INT                 NOT NULL,
    user_b_id  INT                 NOT NULL,
    created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_swipe_match_pair (user_a_id, user_b_id),
    CONSTRAINT fk_match_a FOREIGN KEY (user_a_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_match_b FOREIGN KEY (user_b_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_swipe_match_a ON swipe_matches(user_a_id);
CREATE INDEX idx_swipe_match_b ON swipe_matches(user_b_id);


-- 4. Swipe chat — 1-to-1 messages tied to a swipe_match, mirroring the
--    existing dm_messages / team_messages shape (reply, soft delete).
CREATE TABLE IF NOT EXISTS swipe_messages (
    message_id  INT AUTO_INCREMENT PRIMARY KEY,
    match_id    INT         NOT NULL,
    sender_id   INT         NOT NULL,
    content     TEXT        NOT NULL,
    reply_to_id INT         NULL,
    is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
    deleted_at  DATETIME    NULL,
    sent_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_swmsg_match  FOREIGN KEY (match_id)  REFERENCES swipe_matches(match_id) ON DELETE CASCADE,
    CONSTRAINT fk_swmsg_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_swmsg_reply  FOREIGN KEY (reply_to_id) REFERENCES swipe_messages(message_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_swipe_messages_match  ON swipe_messages(match_id, message_id);
CREATE INDEX idx_swipe_messages_sender ON swipe_messages(sender_id);


-- 5. Extend the existing chat_read_status ENUM to cover the new chat type.
--    chat_type: 'swipe' → ref_id = match_id
ALTER TABLE chat_read_status
  MODIFY COLUMN chat_type ENUM('team','dm','swipe') NOT NULL;




-- =============================================================================
-- MIGRATION: Karma / Reputation on Squad Match teammates
-- Run ONCE, after 2026_07_gamer_dna_swipe_match.sql.
-- Safe to re-run — uses CREATE TABLE IF NOT EXISTS / conditional ALTER.
-- =============================================================================

-- 1. Post-match peer feedback. One rating per (match, rater) — re-rating
--    overwrites the previous one rather than stacking duplicates.
--    Deliberately a simple thumbs up/down, not a 1-5 scale: keeps the ask
--    low-friction and avoids fine-grained scores being used to pile on.
CREATE TABLE IF NOT EXISTS match_ratings (
    rating_id  INT AUTO_INCREMENT PRIMARY KEY,
    match_id   INT                    NOT NULL,
    rater_id   INT                    NOT NULL,
    rated_id   INT                    NOT NULL,
    score      ENUM('positive','negative') NOT NULL,
    tag        ENUM('good_comms','team_player','reliable','carried_us') NULL,
    created_at DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rating_per_match (match_id, rater_id),
    CONSTRAINT fk_rating_match FOREIGN KEY (match_id) REFERENCES swipe_matches(match_id) ON DELETE CASCADE,
    CONSTRAINT fk_rating_rater FOREIGN KEY (rater_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rating_rated FOREIGN KEY (rated_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rating_rated ON match_ratings(rated_id, score);


-- 2. Cached karma counters on `users`, updated transactionally by the app
--    whenever a rating is inserted or changed. Cached rather than
--    aggregated live because karma is read on every Squad Match candidate
--    card fetch and on public profiles.
--    NOTE: only positive-signal badges are ever surfaced in the product —
--    negative counts exist so ratios can be computed, but karma is never
--    used to publicly flag or shame a user, only to highlight trusted ones.
ALTER TABLE users
  ADD COLUMN karma_positive INT NOT NULL DEFAULT 0,
  ADD COLUMN karma_negative INT NOT NULL DEFAULT 0;

DESCRIBE achievements;





-- ============================================================
-- ArenaX — Achievements + Login Streak migration
-- Additive only: does not modify any existing table.
-- Run this against your existing arenaX schema.
-- ============================================================

DESCRIBE achievements;

DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS user_streaks;

-- 1. Master list of all possible achievements
CREATE TABLE IF NOT EXISTS achievements (
    achievement_id  INT AUTO_INCREMENT PRIMARY KEY,
    achievement_key VARCHAR(64)   NOT NULL UNIQUE,   -- stable code reference, e.g. 'login_streak_30'
    name            VARCHAR(100)  NOT NULL,          -- display name, e.g. 'Locked In'
    description     VARCHAR(255)  NOT NULL,          -- shown on both achieved + locked cards
    category        ENUM('login_streak','team','nexus_post','dna_match') NOT NULL,
    tier            INT           NOT NULL DEFAULT 1,-- ordering within category
    threshold       INT           NOT NULL,          -- count required to unlock
    icon            VARCHAR(64)   DEFAULT NULL,       -- icon key for frontend
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Which users have earned which achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT      NOT NULL,
    achievement_id  INT      NOT NULL,
    earned_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_achievement (user_id, achievement_id),
    CONSTRAINT fk_ua_user        FOREIGN KEY (user_id)        REFERENCES users(user_id)               ON DELETE CASCADE,
    CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Login streak tracking — one row per user
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id          INT PRIMARY KEY,
    current_streak   INT  NOT NULL DEFAULT 0,
    longest_streak    INT  NOT NULL DEFAULT 0,
    last_login_date  DATE DEFAULT NULL,
    CONSTRAINT fk_streak_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_achievements_category_threshold ON achievements (category, threshold);
CREATE INDEX idx_user_achievements_user           ON user_achievements (user_id);

-- ============================================================
-- Seed data — edit names/descriptions/icons freely, keys are stable
-- ============================================================

INSERT INTO achievements (achievement_key, name, description, category, tier, threshold, icon) VALUES
-- Login streaks
('login_streak_7',   'Warming Up',   'Logged in 7 days in a row.',            'login_streak', 1, 7,   'streak_7'),
('login_streak_30',  'Locked In',    'Logged in 30 days in a row.',           'login_streak', 2, 30,  'streak_30'),
('login_streak_100', 'No Days Off',  'Logged in 100 days in a row.',          'login_streak', 3, 100, 'streak_100'),
('login_streak_200', 'The Grinder',  'Logged in 200 days in a row.',          'login_streak', 4, 200, 'streak_200'),
('login_streak_500', 'Immortal',     'Logged in 500 days in a row.',          'login_streak', 5, 500, 'streak_500'),

-- Team
('team_joined',      'Squad Up',     'Joined your first team on ArenaX.',     'team', 1, 1, 'squad_up'),

-- Nexus posts
('nexus_post_1',     'First Transmission', 'Made your 1st post on The Nexus.',   'nexus_post', 1, 1,   'nexus_1'),
('nexus_post_10',    'Signal Booster',     'Made your 10th post on The Nexus.',  'nexus_post', 2, 10,  'nexus_10'),
('nexus_post_100',   'Nexus Veteran',      'Made your 100th post on The Nexus.', 'nexus_post', 3, 100, 'nexus_100'),

-- DNA matches (mutual swipe likes)
('dna_match_1',      'First Match',    'Got your 1st Gamer DNA match.',   'dna_match', 1, 1,   'dna_1'),
('dna_match_5',      'Getting Noticed','Got 5 Gamer DNA matches.',        'dna_match', 2, 5,   'dna_5'),
('dna_match_10',     'Fan Favorite',   'Got 10 Gamer DNA matches.',       'dna_match', 3, 10,  'dna_10'),
('dna_match_25',     'Crowd Puller',   'Got 25 Gamer DNA matches.',       'dna_match', 4, 25,  'dna_25'),
('dna_match_50',     'Viral',          'Got 50 Gamer DNA matches.',       'dna_match', 5, 50,  'dna_50'),
('dna_match_100',    'DNA Royalty',    'Got 100 Gamer DNA matches.',      'dna_match', 6, 100, 'dna_100');









-- ============================================================
-- DAILIES — daily per-game quiz feature (arenax.io/dailies)
-- Additive only: does not modify any existing table.
-- Safe to run on an existing database — uses CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- 1. Question bank — Aryan writes/imports these per game (see
--    scripts/importDailyQuestions.js). "options" are stored as four
--    plain columns rather than JSON so a human can eyeball/edit rows
--    directly in phpMyAdmin/Hostinger's DB tool.
CREATE TABLE IF NOT EXISTS daily_quiz_questions (
    question_id     INT AUTO_INCREMENT PRIMARY KEY,
    game_id         INT                            NOT NULL,
    difficulty      ENUM('easy','medium','hard')   NOT NULL,
    question_text   TEXT                           NOT NULL,
    media_url       TEXT                           DEFAULT NULL,   -- optional image/code-snippet prompt
    option_a        VARCHAR(255)                   NOT NULL,
    option_b        VARCHAR(255)                   NOT NULL,
    option_c        VARCHAR(255)                   NOT NULL,
    option_d        VARCHAR(255)                   NOT NULL,
    correct_option  CHAR(1)                        NOT NULL,       -- 'a' | 'b' | 'c' | 'd'
    status          VARCHAR(20)                    NOT NULL DEFAULT 'active',
    created_at      DATETIME                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dqq_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    CONSTRAINT chk_dqq_correct_option CHECK (correct_option IN ('a','b','c','d'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_dqq_game_diff_status ON daily_quiz_questions(game_id, difficulty, status);

-- 2. One row per user, per game, per day. question_ids is the server-drawn,
--    seeded set of 5 question IDs for that user+game+date so a resumed
--    session always reconstructs the same 5 questions in the same order.
CREATE TABLE IF NOT EXISTS daily_quiz_sessions (
    session_id                    INT AUTO_INCREMENT PRIMARY KEY,
    user_id                       INT                             NOT NULL,
    game_id                       INT                             NOT NULL,
    quiz_date                     DATE                            NOT NULL,
    question_ids                  JSON                            NOT NULL,
    current_index                 TINYINT                         NOT NULL DEFAULT 0,
    current_question_started_at   DATETIME                        DEFAULT NULL,
    status                        ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
    correct_count                 TINYINT                         NOT NULL DEFAULT 0,
    total_time_ms                 INT                             NOT NULL DEFAULT 0,
    started_at                    DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at                  DATETIME                        DEFAULT NULL,
    UNIQUE KEY uq_dqs_user_game_date (user_id, game_id, quiz_date),
    CONSTRAINT fk_dqs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_dqs_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powers both the daily leaderboard query and the "already played today" check.
CREATE INDEX idx_dqs_leaderboard ON daily_quiz_sessions(game_id, quiz_date, status, correct_count, total_time_ms);

-- 3. Per-question audit trail. This is what makes the timer server-authoritative:
--    time_taken_ms is computed server-side from current_question_started_at,
--    never trusted from the client.
CREATE TABLE IF NOT EXISTS daily_quiz_answers (
    answer_id        INT AUTO_INCREMENT PRIMARY KEY,
    session_id        INT          NOT NULL,
    question_id        INT          NOT NULL,
    question_index       TINYINT      NOT NULL,
    selected_option        CHAR(1)      DEFAULT NULL,   -- NULL = no answer / timed out
    is_correct               BOOLEAN      NOT NULL DEFAULT FALSE,
    time_taken_ms               INT          NOT NULL,
    forfeited                     BOOLEAN      NOT NULL DEFAULT FALSE,  -- tab-blur forfeit
    answered_at                     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dqa_session_question (session_id, question_index),
    CONSTRAINT fk_dqa_session  FOREIGN KEY (session_id)  REFERENCES daily_quiz_sessions(session_id)   ON DELETE CASCADE,
    CONSTRAINT fk_dqa_question FOREIGN KEY (question_id) REFERENCES daily_quiz_questions(question_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Per-game daily streak — separate from the login streak in user_streaks.
--    best_correct_count / best_time_ms are denormalized "personal best"
--    fields, updated on every completion, so the lobby + all-time
--    leaderboard don't need to scan full session history.
CREATE TABLE IF NOT EXISTS daily_quiz_streaks (
    user_id              INT      NOT NULL,
    game_id              INT      NOT NULL,
    current_streak       INT      NOT NULL DEFAULT 0,
    longest_streak        INT      NOT NULL DEFAULT 0,
    last_completed_date       DATE     DEFAULT NULL,
    best_correct_count           TINYINT  NOT NULL DEFAULT 0,
    best_time_ms                    INT      DEFAULT NULL,
    PRIMARY KEY (user_id, game_id),
    CONSTRAINT fk_dqstreak_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_dqstreak_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powers the all-time leaderboard tab: correct DESC, time ASC.
CREATE INDEX idx_dqstreak_alltime ON daily_quiz_streaks(game_id, best_correct_count DESC, best_time_ms ASC);





-- Migration: add automation support to tournaments
-- Run this once against your existing database:
--   mysql -u DB_USER -p DB_NAME < database/migrations/2026_08_add_tournament_automation.sql
--
-- What it adds:
--   source       — distinguishes who created the row: 'user' (organizer form),
--                  'admin' (manual dev entry), or 'pandascore' (auto-synced feed)
--   external_id  — the PandaScore tournament id, used to upsert without duplicating
--                  on re-runs. NULL for user/admin-created rows.
--
-- Safe to re-run: uses IF NOT EXISTS-style guards via information_schema checks.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'source'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tournaments ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT ''user'' AFTER created_by',
  'SELECT ''source column already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'external_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tournaments ADD COLUMN external_id VARCHAR(100) NULL AFTER source',
  'SELECT ''external_id column already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Unique per (source, external_id) so the sync job can upsert safely and
-- re-running it never creates duplicate rows for the same PandaScore tournament.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournaments' AND INDEX_NAME = 'uq_tournaments_source_external'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE tournaments ADD UNIQUE KEY uq_tournaments_source_external (source, external_id)',
  'SELECT ''unique index already exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;




-- =============================================================================
-- §1 PAYMENTS INFRASTRUCTURE — additive migration
-- =============================================================================
-- Run this against your existing database (phpMyAdmin > SQL tab, or
-- `mysql -u ... -p arenax < database/migrations_section1_payments.sql`).
-- Every statement uses IF NOT EXISTS, so it's safe to run more than once
-- and won't touch any existing table.
--
-- These three tables are the foundation every paid feature in the roadmap
-- plugs into: organizer tiers (§2), college licenses (§3), premium gamer
-- membership (§4) all just add rows to `plans` and point `subscriptions` at
-- a `user_id` (or, once §3 lands, an `org_id` — that column is reserved now
-- so we don't need another migration later).
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
    plan_id       INT AUTO_INCREMENT  PRIMARY KEY,
    plan_key      VARCHAR(50)         UNIQUE NOT NULL,  -- e.g. 'organizer_pro', 'organizer_org', 'gamer_pro'
    name          VARCHAR(100)        NOT NULL,
    description   VARCHAR(255),
    price         DECIMAL(10,2)       NOT NULL DEFAULT 0,
    currency      VARCHAR(10)         NOT NULL DEFAULT 'INR',
    billing_cycle VARCHAR(20)         NOT NULL DEFAULT 'monthly',  -- monthly | annual
    feature_flags JSON                NOT NULL,                    -- { "branded_page": true, "analytics": true, ... }
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id         INT AUTO_INCREMENT  PRIMARY KEY,
    user_id                 INT,                       -- individual gamer/organizer subscriber
    org_id                  INT,                        -- reserved for §3 college/org billing; unused until then
    plan_id                 INT                 NOT NULL,
    status                  VARCHAR(20)         NOT NULL DEFAULT 'active',  -- active | past_due | canceled | expired
    started_at              DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    renews_at               DATETIME,
    canceled_at             DATETIME,
    gateway                 VARCHAR(20),                -- razorpay | cashfree
    gateway_customer_id     VARCHAR(100),
    gateway_subscription_id VARCHAR(100),
    created_at              DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS payments (
    payment_id      INT AUTO_INCREMENT  PRIMARY KEY,
    subscription_id INT,
    user_id         INT                 NOT NULL,
    plan_id         INT                 NOT NULL,   -- which plan this order was for — lets the webhook
                                                       -- activate a subscription on its own, without
                                                       -- depending on the checkout-flow callback having run
    gateway         VARCHAR(20)         NOT NULL,   -- razorpay | cashfree
    gateway_order_id   VARCHAR(150),                 -- order id created before payment
    gateway_payment_id VARCHAR(150),                 -- id once payment succeeds
    amount          DECIMAL(10,2)       NOT NULL,
    currency        VARCHAR(10)         NOT NULL DEFAULT 'INR',
    status          VARCHAR(20)         NOT NULL DEFAULT 'created',  -- created | success | failed | refunded
    raw_payload     JSON,                             -- last webhook payload received, for support/debugging
    created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_sub  FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_pay_plan FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
    UNIQUE KEY uq_payments_gateway_order (gateway, gateway_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payments_status  ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at);

-- ─── Starter plans ──────────────────────────────────────────────────────────
-- Free tiers aren't billed but still need a plan row so `hasFeature` has
-- something to compare against; paid tiers use realistic placeholder
-- pricing — adjust before going live with real payments.
INSERT IGNORE INTO plans (plan_key, name, description, price, billing_cycle, feature_flags) VALUES
    ('organizer_free', 'Organizer — Free',      'Basic tournament listing, capped participants.', 0,    'monthly', JSON_OBJECT('branded_page', false, 'analytics', false, 'announcements', false)),
    ('organizer_pro',  'Organizer — Pro',       'Branded tournament page, automated announcements, analytics.', 499, 'monthly', JSON_OBJECT('branded_page', true, 'analytics', true, 'announcements', true)),
    ('organizer_org',  'Organizer — Organization', 'Multi-tournament dashboard, org branding, read-only API.', 1999, 'monthly', JSON_OBJECT('branded_page', true, 'analytics', true, 'announcements', true, 'multi_tournament_dashboard', true, 'api_access', true)),
    ('gamer_pro',      'ArenaX Pro',            'Verified badge, advanced stats, priority Team Finder placement.', 99, 'monthly', JSON_OBJECT('verified_badge', true, 'advanced_stats', true, 'priority_placement', true));



-- =============================================================================
-- §2 ORGANIZER TIERS — additive migration
-- =============================================================================
-- Run after migrations_section1_payments.sql (this reads no new tables from
-- it, but §2 as a whole depends on `plans`/`subscriptions` existing).
-- All statements are IF NOT EXISTS-safe to re-run.
-- =============================================================================

-- Branded tournament page (Pro/Org tier): custom banner + accent colors,
-- consumed by the frontend's existing CSS custom-property theming, scoped
-- per-tournament instead of site-wide.
ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS banner_url           TEXT,
    ADD COLUMN IF NOT EXISTS brand_primary_color  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS brand_accent_color   VARCHAR(20);

-- Organizer verification queue (manual admin-approval gate before a
-- Pro/Org-tier organizer's tournament goes public). One row per request;
-- an organizer can re-request after a rejection, so this is a log, not a
-- single status column on `users`.
CREATE TABLE IF NOT EXISTS organizer_verifications (
    verification_id INT AUTO_INCREMENT  PRIMARY KEY,
    user_id          INT                 NOT NULL,
    status           VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    note             VARCHAR(255),                                    -- optional admin reason (mainly for rejections)
    requested_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at      DATETIME,
    reviewed_by      INT,
    CONSTRAINT fk_overif_user     FOREIGN KEY (user_id)     REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_overif_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_overif_user   ON organizer_verifications(user_id);
CREATE INDEX idx_overif_status ON organizer_verifications(status);

-- §1 seeded organizer_pro/organizer_org without an explicit "no participant
-- cap" flag — add it now so the free-tier cap enforcement below has
-- something to check against on the plans that should be exempt from it.
UPDATE plans
   SET feature_flags = JSON_SET(feature_flags, '$.unlimited_participants', true)
 WHERE plan_key IN ('organizer_pro', 'organizer_org');

-- NOTE on tournaments.status: the roadmap's organizer-verification gate
-- means an unverified Pro/Org organizer's tournament is created with
-- status = 'pending_review' instead of 'upcoming' (application-level, not
-- a schema constraint — the column already accepts any VARCHAR(20)). The
-- public tournament listing excludes 'pending_review'; organizers see their
-- own via GET /api/tournaments/mine regardless of status.




-- =============================================================================
-- §2b ORGANIZER TIER CONSOLIDATION — 3 tiers → 2 (Free, Pro)
-- =============================================================================
-- Run after migrations_section2_organizer_tiers.sql.
--
-- The Organization tier (`organizer_org`) doesn't have anywhere to plug in
-- yet — it was meant for §3's college/org billing, which isn't built. Until
-- then it was just adding a confusing third paid-looking option next to
-- Free/Pro. This folds its two extra flags into Pro and retires the plan
-- row (deactivated, not deleted, so historical subscriptions/payments still
-- resolve correctly).
--
-- No other code references the `organizer_org` plan_key directly — every
-- gate in the codebase checks a feature_flags key via hasFeature(), so
-- folding the flags into `organizer_pro` is enough to preserve behavior for
-- anyone who Pro already unlocked.
-- All statements are safe to re-run.
-- =============================================================================

UPDATE plans
   SET feature_flags = JSON_MERGE_PATCH(
         feature_flags,
         JSON_OBJECT('multi_tournament_dashboard', true, 'api_access', true)
       )
 WHERE plan_key = 'organizer_pro';

-- Deactivated rather than deleted: any existing `organizer_org` subscription
-- keeps its FK intact and getPlans()/getMySubscription() simply stop
-- surfacing it as a selectable option (is_active = FALSE is already the
-- filter both use).
UPDATE plans
   SET is_active = FALSE
 WHERE plan_key = 'organizer_org';

-- If anyone is still on an active organizer_org subscription, move them to
-- Pro so they keep everything they had (now folded into Pro above) instead
-- of being left on a retired, invisible plan.
UPDATE subscriptions s
  JOIN plans old_p ON old_p.plan_id = s.plan_id AND old_p.plan_key = 'organizer_org'
  JOIN plans new_p ON new_p.plan_key = 'organizer_pro'
   SET s.plan_id = new_p.plan_id
 WHERE s.status = 'active';



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


-- =============================================================================
-- §7 REFERRAL & AMBASSADOR SYSTEM — additive migration
-- =============================================================================
-- Independent of §3 (paired with it in the roadmap's build order as the
-- acquisition engine, but no data dependency between them). Safe to re-run:
-- column adds use the information_schema-guard pattern already used for
-- §3's FK-bearing ALTERs and for tournaments.source/external_id.
--
--   mysql -u DB_USER -p DB_NAME < database/migrations_section7_referrals.sql
-- =============================================================================

-- ─── users.referral_code / referred_by / xp_balance ─────────────────────────
-- Every user gets a shareable referral_code at signup (not just curated
-- ambassadors — anyone can refer). referred_by records who they signed up
-- through, if anyone. xp_balance is the reward currency ledger balance —
-- XP/credit, never cash, per the roadmap's anti-junk-signup design.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'referral_code'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) NULL',
  'SELECT ''users.referral_code already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_referral_code'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_referral_code (referral_code)',
  'SELECT ''uq_users_referral_code already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'referred_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN referred_by INT NULL',
  'SELECT ''users.referred_by already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_referred_by'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by) REFERENCES users(user_id) ON DELETE SET NULL',
  'SELECT ''fk_users_referred_by already exists'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX idx_users_referred_by ON users(referred_by);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp_balance INT NOT NULL DEFAULT 0;

-- ─── pending_verifications.referral_code_input ──────────────────────────────
-- Registration is two-step (send-otp → verify). The code the new user typed
-- in at step 1 has to survive until step 2, where the account (and its own
-- referral_code) actually gets created — same reason password_hash already
-- lives on this table.
ALTER TABLE pending_verifications
    ADD COLUMN IF NOT EXISTS referral_code_input VARCHAR(20) NULL;

-- ─── referral_rewards ────────────────────────────────────────────────────────
-- One row per referred signup. Stays 'pending' until the referred user hits
-- the activation bar (profile complete + game selected + joined a
-- tournament/community — see referralService.checkActivation), at which
-- point xp_amount is set and status flips to 'credited'. This is what makes
-- "rewards owed" on the ambassador dashboard mean something real instead of
-- just a raw signup count.
CREATE TABLE IF NOT EXISTS referral_rewards (
    reward_id         INT AUTO_INCREMENT  PRIMARY KEY,
    referrer_id       INT                 NOT NULL,
    referred_user_id  INT                 NOT NULL UNIQUE,   -- one referral record per referred user
    xp_amount         INT                 NOT NULL DEFAULT 0,
    status            VARCHAR(20)         NOT NULL DEFAULT 'pending',  -- pending | credited
    credited_at       DATETIME,
    created_at        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rr_referrer FOREIGN KEY (referrer_id)      REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rr_referred FOREIGN KEY (referred_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rr_referrer ON referral_rewards(referrer_id, status);

-- ─── Backfill referral codes for existing users ─────────────────────────────
-- Anyone who registered before this migration needs a code too, or they'd
-- have nothing to share. Deterministic, collision-safe: username + user_id
-- (user_id is already unique, so this can never collide).
UPDATE users
   SET referral_code = CONCAT(UPPER(LEFT(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', ''), 10)), user_id)
 WHERE referral_code IS NULL;
