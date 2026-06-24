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
    CONSTRAINT fk_t_creator   FOREIGN KEY (created_by)   REFERENCES users(user_id)                      ON DELETE SET NULL
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
