CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    profile_picture TEXT,
    country VARCHAR(50),
    region VARCHAR(50),
    bio TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE games (
    game_id SERIAL PRIMARY KEY,
    game_name VARCHAR(100) UNIQUE NOT NULL,
    genre VARCHAR(50),
    developer VARCHAR(100),
    release_year INT,
    icon TEXT,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE user_game_profile (
    profile_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    game_id INT REFERENCES games(game_id) ON DELETE CASCADE,
    rank VARCHAR(50),
    role VARCHAR(50),
    win_rate DECIMAL(5,2),
    matches_played INT DEFAULT 0,
    elo_rating INT,
    UNIQUE(user_id, game_id)
);

CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    logo TEXT,
    region VARCHAR(50),
    created_by INT REFERENCES users(user_id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
    team_member_id SERIAL PRIMARY KEY,
    team_id INT REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE(team_id, user_id)
);

CREATE TABLE team_invitations (
    invite_id SERIAL PRIMARY KEY,
    team_id INT REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    invited_by INT REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournament_organizers (
    organizer_id SERIAL PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    website TEXT,
    contact_email VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tournaments (
    tournament_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    game_id INT REFERENCES games(game_id),
    organizer_id INT REFERENCES tournament_organizers(organizer_id),
    prize_pool DECIMAL(12,2),
    entry_fee DECIMAL(10,2),
    region VARCHAR(50),
    format VARCHAR(50),
    start_date DATE,
    end_date DATE,
    registration_deadline DATE,
    status VARCHAR(20) DEFAULT 'upcoming'
);

CREATE TABLE tournament_registrations (
    registration_id SERIAL PRIMARY KEY,
    tournament_id INT REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    team_id INT REFERENCES teams(team_id) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    UNIQUE(tournament_id, team_id)
);

CREATE TABLE matches (
    match_id SERIAL PRIMARY KEY,
    tournament_id INT REFERENCES tournaments(tournament_id),
    team1_id INT REFERENCES teams(team_id),
    team2_id INT REFERENCES teams(team_id),
    match_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'scheduled',
    winner_team_id INT REFERENCES teams(team_id),
    score VARCHAR(20)
);

CREATE TABLE match_player_stats (
    stat_id SERIAL PRIMARY KEY,
    match_id INT REFERENCES matches(match_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id),
    kills INT DEFAULT 0,
    deaths INT DEFAULT 0,
    assists INT DEFAULT 0,
    damage INT DEFAULT 0,
    mvp BOOLEAN DEFAULT FALSE
);

CREATE TABLE communities (
    community_id SERIAL PRIMARY KEY,
    game_id INT REFERENCES games(game_id),
    name VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_posts (
    post_id SERIAL PRIMARY KEY,
    community_id INT REFERENCES communities(community_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id),
    title VARCHAR(200),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    upvotes INT DEFAULT 0,
    downvotes INT DEFAULT 0
);

CREATE TABLE post_comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INT REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES users(user_id),
    receiver_id INT REFERENCES users(user_id),
    content TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN DEFAULT FALSE
);

CREATE TABLE team_finder_posts (
    post_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    game_id INT REFERENCES games(game_id),
    rank_required VARCHAR(50),
    role_required VARCHAR(50),
    region VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_finder_applications (
    application_id SERIAL PRIMARY KEY,
    post_id INT REFERENCES team_finder_posts(post_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE streams (
    stream_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    platform VARCHAR(50),
    stream_url TEXT,
    game_id INT REFERENCES games(game_id),
    title VARCHAR(200),
    started_at TIMESTAMP,
    status VARCHAR(20),
    viewer_count INT DEFAULT 0
);

CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50),
    message TEXT,
    related_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE achievements (
    achievement_id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    icon TEXT
);

CREATE TABLE user_achievements (
    user_achievement_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id INT REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
    report_id SERIAL PRIMARY KEY,
    reported_user INT REFERENCES users(user_id),
    reported_by INT REFERENCES users(user_id),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    type VARCHAR(50),
    data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tournaments_game ON tournaments(game_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);

SELECT tablename FROM pg_tables WHERE schemaname = 'public';