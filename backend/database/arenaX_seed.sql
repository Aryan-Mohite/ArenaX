-- =============================================================================
-- ArenaX Esports Platform — Seed / Instance Data (v2.1 — fixed)
-- Run AFTER arenaX_schema.sql
-- =============================================================================
-- psql -U postgres -d your_db -f arenaX_seed.sql
-- =============================================================================
-- NOTE: All password hashes below are bcrypt hashes of "Password123!" (12 rounds)
--       Generate your own:
--         node -e "const b=require('bcrypt');b.hash('Password123!',12).then(console.log)"
-- =============================================================================
-- ABOUT GAME DATA:
--   Games are seeded here directly from your backend/data/games.json.
--   The backend's POST /api/games/sync route reads the same file at runtime
--   and upserts into this table — so both sources stay in sync automatically.
--   You do NOT need to manually maintain game data in two places; the seed
--   here just pre-populates the DB on first install so the app works
--   immediately without needing the backend running first.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. GAMES  (sourced 1-to-1 from backend/data/games.json)
-- =============================================================================

INSERT INTO games (game_name, slug, genre, developer, release_year, rating, platforms, description, cover_image, screenshots)
VALUES
('Counter-Strike', 'counter-strike', 'Tactical FPS', 'Valve', 2000, 4.8, 'PC / Console', 'The world''s most iconic tactical first-person shooter. Two teams — Terrorists and Counter-Terrorists — battle across iconic maps in search and destroy scenarios. Known for its precise gunplay, deep competitive meta, and massive esports scene.', 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg', ARRAY['https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/ss_34090f24290a2f6b5b16cf2b4d9a1b6c67bbb66e.jpg','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/ss_b601b58a6bf29ca97bded48d74d0e8eb1d5c2d0c.jpg']),
('Dota 2', 'dota-2', 'MOBA', 'Valve', 2013, 4.6, 'PC / Console', 'Dota 2 is a deep, complex multiplayer online battle arena where two teams of five heroes clash to destroy the enemy Ancient. With over 120 heroes, a rich item system, and The International — one of the world''s biggest esports events — Dota 2 rewards thousands of hours of mastery.', 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/header.jpg', ARRAY['https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/ss_86d675fdc73ba10462abb8f5eca2b5e90bcf0b47.jpg','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/ss_b1e2a21de6fec5a6e6d82be93a23a90c7e3c3a6b.jpg']),
('Apex Legends', 'apex-legends', 'Battle Royale', 'Respawn Entertainment', 2019, 4.5, 'PC / Console', 'Apex Legends is a free-to-play battle royale where squads of three choose from a roster of Legends with unique abilities. Fast movement, ping communication, and hero synergy set it apart. The ALGS (Apex Legends Global Series) hosts millions in prize money annually.', 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg', ARRAY['https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/ss_3b5082d0b5f3d7f5e8c6b9e9bcdde5ac2fc31ef0.jpg','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/ss_45fbde7d0d21b4e4e8b2f5a0c2e0f3a7e42d3c8e.jpg']),
('Valorant', 'valorant', 'Tactical FPS', 'Riot Games', 2020, 4.7, 'PC / Console', 'Valorant is Riot Games'' tactical FPS blending precise gunplay with hero abilities. Two teams of five agents battle over a spike plant/defuse objective across multiple maps. The VCT (Valorant Champions Tour) is one of the fastest growing esports ecosystems globally.', 'https://cdn.akamai.steamstatic.com/steam/apps/2357570/header.jpg', ARRAY['https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt97bc0e77bbdfc64e/62e0cac5cdc67a44b7474a30/Valorant_2022_E5A1_PlayVALORANT_ContentStackThumbnail_1200x625_MB01.jpg','https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt7fdf52e65ec52a62/5eb75e5f4f08d54fd18d3374/122220_VALORANT_AgentPage_Jett_Banner.jpg']),
('League of Legends', 'league-of-legends', 'MOBA', 'Riot Games', 2009, 4.5, 'PC / Console', 'League of Legends is the most played PC game in the world. Two teams of five champions battle to destroy the enemy Nexus across Summoner''s Rift. With hundreds of champions, deep strategic depth, and the Worlds Championship drawing tens of millions of viewers, LoL is the defining esport.', 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg', ARRAY['https://cdn1.epicgames.com/offer/24b9b5e323bc40eea252a10cdd3b2f10/EGS_LeagueofLegends_RiotGames_S1_2560x1440-80471984a05c2c6b3ba2d3986f8c92a8','https://cdn1.epicgames.com/offer/24b9b5e323bc40eea252a10cdd3b2f10/EGS_LeagueofLegends_RiotGames_S1_2560x1440-80471984a05c2c6b3ba2d3986f8c92a8']),
('Call of Duty: Warzone', 'warzone', 'Battle Royale', 'Activision', 2020, 4.3, 'PC / Console', 'Call of Duty: Warzone is a free-to-play battle royale dropping up to 150 players into Verdansk, Al Mazrah, and Urzikstan. With COD gunplay at its core, the Gulag resurrection system, and cross-play across all platforms, Warzone became one of the most-played games ever released.', 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1962663/header.jpg', ARRAY['https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1962663/ss_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b.jpg','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1962663/ss_0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a.jpg']),
('Battlegrounds Mobile India', 'battlegrounds-mobile-india', 'Battle Royale', 'Krafton', 2021, 4.3, 'Mobile', 'BGMI is the India-exclusive version of PUBG Mobile, built specifically for the Indian gaming audience. Teams of 4 compete across Erangel, Miramar, and Sanhok maps to be the last squad standing. BGMI Esports has exploded with massive prize pools and dedicated regional circuits.', 'https://play-lh.googleusercontent.com/JRd05pyBH41qjgsR_CDje2bF6EMk2WPFUdG5sNYjQOZ12M9hulZ_5a6CeYGXTxM4_Pg', ARRAY['https://play-lh.googleusercontent.com/L8nRV7h0g6fO-WRQsNH0BKD1YQb5Z5KX9cC-ZEkb5cY0j0dCRXnwYq7dX3O53kXXzQ','https://play-lh.googleusercontent.com/1HW3zxNVjxpn3C16V62J3EjbU3-mFk1LQj68fPJLG5VnExq7p7FaR9SWY4oKy3-5UA']),
('PUBG: Battlegrounds', 'pubg-battlegrounds', 'Battle Royale', 'Krafton', 2017, 4.2, 'PC / Console', 'PUBG: Battlegrounds is the original battle royale that launched a genre. Up to 100 players parachute onto an island, scavenge for weapons and gear, and fight to be the last one standing inside a shrinking playzone. PUBG Global Championship is one of the most prestigious BR esports events.', 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg', ARRAY['https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/578080/ss_2f6e8a2b9e45d6f0c1b9a0d8a5e44c6b8f4d5c3e.jpg','https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/578080/ss_7b3e5c1f0d9a4e2b8f6c0a3d7e1b5f9c2a4e6d8b.jpg']),
('Free Fire', 'free-fire', 'Battle Royale', 'Garena', 2017, 4.2, 'Mobile', 'Garena Free Fire is the most downloaded mobile game in the world. 50 players drop onto a remote island, scavenge for weapons, and battle to be the last one alive in matches under 10 minutes. Designed for low-end devices, Free Fire has built a massive esports ecosystem across South and Southeast Asia.', 'https://play-lh.googleusercontent.com/WWcMGBjDMXpHyBFfxDhVuGpVZYyBECjTMj-hHX6BSipJoMv-Z_iMU6dFM3f2hE5RXQE', ARRAY['https://play-lh.googleusercontent.com/z_r3sL0yc4Y5WfN1s5K5q4kNcDiDdkJJvGXjQRlpNfFn-8dXAfJsJLBE3g3WQz63Hg','https://play-lh.googleusercontent.com/3Kc3K_fFNr0c2q5XQsXZ8qR_6J0j2VxV8m5-tRZ9sxJP6N9Lv3mZ6iKmZ7F9XqXxWA']),
('Fortnite', 'fortnite', 'Battle Royale', 'Epic Games', 2017, 4.4, 'PC / Console', 'Fortnite is the world''s biggest battle royale phenomenon. 100 players drop into a colorful island, build structures, and fight to be the last one standing. Epic''s Fortnite Champion Series and mega-events like Fortnite World Cup offer millions in prize money and millions more viewers worldwide.', 'https://cdn2.unrealengine.com/fortnite-chapter5-season4-key-art-1920x1080-dc5ac6ce6a4b.jpg', ARRAY['https://cdn2.unrealengine.com/14br-ch4s4-kv-landscape-1920x1080-3d0c1e2f.jpg','https://cdn2.unrealengine.com/fortnite-og-1920x1080-1920x1080-6dbaa65d1c3a.jpg']),
('Call of Duty: Mobile', 'cod-mobile', 'FPS', 'Activision / TiMi Studio', 2019, 4.4, 'Mobile', 'Call of Duty: Mobile brings the signature COD multiplayer experience — classic maps, ranked play, and a full battle royale mode — to mobile devices. With iconic maps like Nuketown and Shipment, intuitive touch controls, and the COD Mobile World Championship, it is the #1 mobile FPS globally.', 'https://play-lh.googleusercontent.com/3rQX4_9s3f8hLO_4Z5Kf8FYz1-HI6LqDMlGF7P_M6G2lhSGXiMw7G4RBvMwGr_mvJE', ARRAY['https://play-lh.googleusercontent.com/gEqI8Fba0cR5OPLOAfGwjF1P_0aMXzjUzj_gzM_zjrqJP-NaYOjH3l-3zZcNbzGhWQ','https://play-lh.googleusercontent.com/hNz5fB1H3G5tV3T8R1X2Kw4ZX5L7M9P1Q3S5U7W9Y1A3C5E7G9I1K3M5O7Q9S1U3W5Y']);

-- =============================================================================
-- 2. USERS  (10 sample accounts)
-- =============================================================================
-- Password for all users: "Password123!" — change before production.

INSERT INTO users (username, email, password_hash, country, region, bio, status) VALUES
('sniper_raj',   'raj@example.com',    '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'BGMI & Valorant grinder. IGL for team ArenaX.',      'active'),
('apex_priya',   'priya@example.com',  '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'Apex Legends Diamond. Love competitive FPS.',         'active'),
('cs_vikram',    'vikram@example.com', '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'CS2 Faceit Level 8. Entry fragger main.',             'active'),
('val_ananya',   'ananya@example.com', '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'Valorant Platinum IGL. Looking for serious team.',    'active'),
('dota_arjun',   'arjun@example.com',  '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'Dota 2 Ancient MMR. Support/Offlane.',                'active'),
('ff_meera',     'meera@example.com',  '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'Free Fire pro. Multiple tournament winner.',          'active'),
('rl_karan',     'karan@example.com',  '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'Rocket League Champion rank. All positions.',         'active'),
('lol_deepa',    'deepa@example.com',  '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'LoL Gold jungler. Casual to competitive.',            'active'),
('mlbb_suresh',  'suresh@example.com', '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'South Asia', 'MLBB Mythical Glory. EXP lane specialist.',           'active'),
('admin_arena',  'admin@arenax.gg',    '$2b$12$LQv3c1yqBwEHFg5RNjPp7OeDRrfTOh3mMB/a/FZe5R8JkSxG4uvYi', 'India', 'Global',     'ArenaX platform administrator.',                     'active')
ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- 3. USER GAME PROFILES
-- =============================================================================

INSERT INTO user_game_profile (user_id, game_id, rank, role, win_rate, matches_played, elo_rating)
SELECT u.user_id, g.game_id, profile.rank, profile.role, profile.win_rate, profile.matches_played, profile.elo_rating
FROM (VALUES
    ('sniper_raj',  'Battlegrounds Mobile India', 'Conqueror',     'Squad Leader',  68.5, 850,  2450),
    ('sniper_raj',  'Valorant',                   'Platinum 2',    'Duelist',       54.0, 320,  1500),
    ('apex_priya',  'Apex Legends',               'Diamond IV',    'Legend',        61.0, 540,  2000),
    ('cs_vikram',   'Counter-Strike',             'Faceit 8',      'Entry Fragger', 57.2, 1200, 1800),
    ('val_ananya',  'Valorant',                   'Platinum 3',    'IGL',           58.0, 480,  1550),
    ('dota_arjun',  'Dota 2',                     'Ancient 2',     'Support',       52.3, 3400, 4200),
    ('ff_meera',    'Free Fire',                  'Heroic',        'Rusher',        72.0, 1100, 2800),
    ('rl_karan',    'Rocket League',              'Champion 1',    'Rotator',       55.5, 760,  1700),
    ('lol_deepa',   'League of Legends',          'Gold IV',       'Jungler',       50.1, 290,  1300),
    ('mlbb_suresh', 'Mobile Legends: Bang Bang',  'Mythical Glory','EXP Lane',      64.0, 920,  2200)
) AS profile(username, game_name, rank, role, win_rate, matches_played, elo_rating)
JOIN users u ON u.username  = profile.username
JOIN games g ON g.game_name = profile.game_name
ON CONFLICT (user_id, game_id) DO NOTHING;


-- =============================================================================
-- 4. SOCIAL — follows
-- =============================================================================

INSERT INTO user_follows (follower_id, following_id)
SELECT u1.user_id, u2.user_id
FROM (VALUES
    ('sniper_raj',  'apex_priya'),
    ('sniper_raj',  'cs_vikram'),
    ('apex_priya',  'sniper_raj'),
    ('apex_priya',  'val_ananya'),
    ('cs_vikram',   'sniper_raj'),
    ('val_ananya',  'cs_vikram'),
    ('dota_arjun',  'lol_deepa'),
    ('ff_meera',    'sniper_raj'),
    ('rl_karan',    'apex_priya'),
    ('mlbb_suresh', 'ff_meera')
) AS pairs(follower, following)
JOIN users u1 ON u1.username = pairs.follower
JOIN users u2 ON u2.username = pairs.following
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 5. TEAMS
-- =============================================================================

INSERT INTO teams (team_name, game_id, logo, region, description, created_by)
SELECT t.team_name, g.game_id, t.logo, t.region, t.description, u.user_id
FROM (VALUES
    ('ArenaX Alpha',   'Valorant',                   NULL, 'South Asia', 'Top Valorant squad from ArenaX platform. Serious players only.',   'val_ananya'),
    ('Headshot Kings', 'Counter-Strike',             NULL, 'South Asia', 'Competitive CS2 team. We play to win.',                            'cs_vikram'),
    ('Storm Riders',   'Battlegrounds Mobile India', NULL, 'South Asia', 'BGMI Conqueror squad. Weekly scrims and tournaments.',              'sniper_raj'),
    ('Apex Vanguard',  'Apex Legends',               NULL, 'South Asia', 'Apex Legends team competing in ALGS open qualifiers.',              'apex_priya'),
    ('Nexus Dota',     'Dota 2',                     NULL, 'South Asia', 'Ancient+ stack looking to hit Immortal bracket.',                   'dota_arjun')
) AS t(team_name, game_name, logo, region, description, captain)
JOIN games g ON g.game_name = t.game_name
JOIN users u ON u.username  = t.captain
ON CONFLICT (team_name) DO NOTHING;


-- =============================================================================
-- 6. TEAM MEMBERS
-- =============================================================================

INSERT INTO team_members (team_id, user_id, role, status)
SELECT te.team_id, u.user_id, pairs.role, 'active'
FROM (VALUES
    ('ArenaX Alpha',   'val_ananya',  'captain'),
    ('ArenaX Alpha',   'cs_vikram',   'member'),
    ('ArenaX Alpha',   'apex_priya',  'member'),
    ('Headshot Kings', 'cs_vikram',   'captain'),
    ('Headshot Kings', 'sniper_raj',  'member'),
    ('Storm Riders',   'sniper_raj',  'captain'),
    ('Storm Riders',   'ff_meera',    'member'),
    ('Apex Vanguard',  'apex_priya',  'captain'),
    ('Nexus Dota',     'dota_arjun',  'captain'),
    ('Nexus Dota',     'lol_deepa',   'member')
) AS pairs(team_name, username, role)
JOIN teams te ON te.team_name = pairs.team_name
JOIN users u  ON u.username   = pairs.username
ON CONFLICT (team_id, user_id) DO NOTHING;


-- =============================================================================
-- 7. TOURNAMENT ORGANIZERS
-- =============================================================================

INSERT INTO tournament_organizers (organization_name, website, contact_email, verified) VALUES
('ArenaX Official',     'https://arenax.gg',          'events@arenax.gg',        TRUE),
('ESL India',           'https://eslindia.gg',         'ops@eslindia.gg',          TRUE),
('Nodwin Gaming',       'https://nodwingaming.com',    'esports@nodwingaming.com', TRUE),
('Community Organizer', NULL,                          NULL,                       FALSE)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 8. TOURNAMENTS
-- =============================================================================

INSERT INTO tournaments (
    name, game_id, organizer_id, created_by,
    prize_pool, entry_fee, region, format,
    start_date, end_date, registration_deadline,
    status, description, organizer_name, location
)
SELECT
    t.name, g.game_id, o.organizer_id, u.user_id,
    t.prize_pool, t.entry_fee, t.region, t.format,
    t.start_date::DATE, t.end_date::DATE, t.reg_deadline::DATE,
    t.status, t.description, t.organizer_name, t.location
FROM (VALUES
    ('ArenaX Valorant Open S1',     'Valorant',                   'ArenaX Official',     'admin_arena',
     50000.00,  0.00,   'South Asia', 'single_elimination',
     '2026-05-10','2026-05-12','2026-05-07',
     'upcoming',  'Open qualifier for aspiring Valorant teams across South Asia.', 'ArenaX Official', 'Online'),

    ('BGMI Pro League — April',     'Battlegrounds Mobile India', 'ESL India',           'admin_arena',
     200000.00, 500.00, 'South Asia', 'round_robin',
     '2026-04-25','2026-04-28','2026-04-22',
     'ongoing',   'Monthly BGMI Pro League. Top 16 teams battle for supremacy.', 'ESL India', 'Online'),

    ('Apex Legends South Asia Cup', 'Apex Legends',               'Nodwin Gaming',       'admin_arena',
     75000.00,  0.00,   'South Asia', 'double_elimination',
     '2026-06-01','2026-06-03','2026-05-28',
     'upcoming',  'The biggest Apex tournament in South Asia. ALGS points on the line.', 'Nodwin Gaming', 'Mumbai, India'),

    ('CS2 Community Clash',         'Counter-Strike',             'Community Organizer', 'cs_vikram',
     10000.00,  100.00, 'South Asia', 'swiss',
     '2026-05-18','2026-05-19','2026-05-15',
     'upcoming',  'Community-run CS2 tournament. All skill levels welcome.', 'Community Organizer', 'Online'),

    ('Dota 2 Winter Invitational',  'Dota 2',                     'ArenaX Official',     'admin_arena',
     150000.00, 0.00,   'South Asia', 'double_elimination',
     '2026-03-01','2026-03-05','2026-02-25',
     'completed',  'Closed invitational for top 8 SA Dota 2 teams.', 'ArenaX Official', 'Online')
) AS t(name, game_name, org_name, creator, prize_pool, entry_fee, region, format,
       start_date, end_date, reg_deadline, status, description, organizer_name, location)
JOIN games                 g ON g.game_name          = t.game_name
JOIN tournament_organizers o ON o.organization_name  = t.org_name
JOIN users                 u ON u.username            = t.creator
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 9. TOURNAMENT REGISTRATIONS
-- =============================================================================

INSERT INTO tournament_registrations (tournament_id, team_id, status)
SELECT t.tournament_id, te.team_id, pairs.status
FROM (VALUES
    ('ArenaX Valorant Open S1',     'ArenaX Alpha',   'confirmed'),
    ('ArenaX Valorant Open S1',     'Headshot Kings', 'confirmed'),
    ('BGMI Pro League — April',     'Storm Riders',   'confirmed'),
    ('Apex Legends South Asia Cup', 'Apex Vanguard',  'pending'),
    ('CS2 Community Clash',         'Headshot Kings', 'confirmed'),
    ('Dota 2 Winter Invitational',  'Nexus Dota',     'confirmed')
) AS pairs(tournament_name, team_name, status)
JOIN tournaments t  ON t.name      = pairs.tournament_name
JOIN teams       te ON te.team_name = pairs.team_name
ON CONFLICT (tournament_id, team_id) DO NOTHING;


-- =============================================================================
-- 10. MATCHES
-- =============================================================================

INSERT INTO matches (tournament_id, team1_id, team2_id, winner_team_id, match_date, status, score, round)
SELECT
    t.tournament_id,
    te1.team_id,
    te2.team_id,
    CASE WHEN m.winner = m.team1 THEN te1.team_id
         WHEN m.winner = m.team2 THEN te2.team_id
         ELSE NULL END,
    m.match_date::TIMESTAMP,
    m.status, m.score, m.round
FROM (VALUES
    ('Dota 2 Winter Invitational', 'Nexus Dota',  'ArenaX Alpha',  'Nexus Dota', '2026-03-01 14:00', 'completed', '2-0', 'Quarter Final'),
    ('BGMI Pro League — April',    'Storm Riders', 'Apex Vanguard', NULL,         '2026-04-26 16:00', 'scheduled', NULL,  'Group Stage')
) AS m(tournament_name, team1, team2, winner, match_date, status, score, round)
JOIN tournaments t   ON t.name        = m.tournament_name
JOIN teams       te1 ON te1.team_name = m.team1
JOIN teams       te2 ON te2.team_name = m.team2
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 11. COMMUNITIES  (one per game)
-- =============================================================================

INSERT INTO communities (game_id, name, description)
SELECT g.game_id,
       g.game_name || ' Community',
       'Official ArenaX community for ' || g.game_name || ' players. Share tips, find teammates, discuss meta.'
FROM games g
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 12. COMMUNITY POSTS
-- =============================================================================

INSERT INTO community_posts (community_id, user_id, title, content, upvotes)
SELECT c.community_id, u.user_id, p.title, p.content, p.upvotes
FROM (VALUES
    ('Valorant',                   'val_ananya',
     'Looking for IGL tips for Valorant ranked',
     'I''ve been IGLing in plat for a while now. Anyone have tips on mid-round calling? I often overthink it under pressure.',
     42),
    ('Counter-Strike',             'cs_vikram',
     'Aim training routine that took me to Faceit 8',
     'Spend 30 mins daily: 10 on dm_run_and_gun, 10 on yprac maps, 10 on deathmatch. Consistency beats raw grind.',
     87),
    ('Battlegrounds Mobile India', 'sniper_raj',
     'Best drop spots in Erangel post patch?',
     'Pochinki seems weaker now after the loot rebalance. Georgopol containers still slap though.',
     31),
    ('Apex Legends',               'apex_priya',
     'Season meta analysis — best comp for ranked?',
     'I''ve been running Bloodhound + Lifeline + Rampart. Zone control + healing = easy top 3.',
     56),
    ('Dota 2',                     'dota_arjun',
     'Support itemization in the current patch',
     'Boots of Bearing into Mekansm has been my go-to on Omniknight. Skipping early wards if supports are broke is acceptable now.',
     29)
) AS p(game_name, username, title, content, upvotes)
JOIN communities c ON c.name     = p.game_name || ' Community'
JOIN users       u ON u.username = p.username
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 13. POST COMMENTS
-- =============================================================================

INSERT INTO post_comments (post_id, user_id, content)
SELECT cp.post_id, u.user_id, cmt.content
FROM (VALUES
    ('Looking for IGL tips for Valorant ranked',     'cs_vikram',   'Trust your read and commit. Bad call executed well > good call half-hearted.'),
    ('Looking for IGL tips for Valorant ranked',     'apex_priya',  'Watch pro VoDs specifically for mid-round calling, not just overall strat.'),
    ('Aim training routine that took me to Faceit 8','sniper_raj',  'Adding this to my routine today. Thanks for sharing!'),
    ('Best drop spots in Erangel post patch?',       'ff_meera',    'Farm House north of Pochinki is underrated. Good loot, quick rotation.')
) AS cmt(post_title, username, content)
JOIN community_posts cp ON cp.title  = cmt.post_title
JOIN users           u  ON u.username = cmt.username
ON CONFLICT DO NOTHING;

UPDATE community_posts cp
SET comment_count = (
    SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = cp.post_id
);


-- =============================================================================
-- 14. TEAM FINDER POSTS
-- =============================================================================

INSERT INTO team_finder_posts (user_id, game_id, team_id, rank_required, role_required, region, description, status, deadline)
SELECT u.user_id, g.game_id, te.team_id, fp.rank_required, fp.role_required, fp.region, fp.description, fp.status,
       CASE WHEN fp.deadline IS NULL THEN NULL ELSE fp.deadline::TIMESTAMPTZ END
FROM (VALUES
    ('val_ananya', 'Valorant',                   'ArenaX Alpha',   'Platinum+', 'Duelist',   'South Asia', 'Looking for a dedicated duelist for our Valorant roster. Must be available for scrims weekday evenings.',         'open', '2026-05-20 23:59:59'),
    ('sniper_raj', 'Battlegrounds Mobile India', 'Storm Riders',   'Ace+',      'Assaulter', 'South Asia', 'Storm Riders needs an aggressive assaulter for BGMI Pro League. Must have IGL experience or strong game sense.','open', '2026-04-30 23:59:59'),
    ('cs_vikram',  'Counter-Strike',             'Headshot Kings', 'Faceit 7+', 'AWPer',     'South Asia', 'Headshot Kings recruiting an AWPer for CS2. Active scrim schedule. Must use Discord.',                        'open', '2026-05-15 23:59:59'),
    ('apex_priya', 'Apex Legends',               'Apex Vanguard',  'Diamond+',  'Support',   'South Asia', 'Apex Vanguard is looking for a Lifeline/Newcastle main for ranked and tournament play.',                      'open', '2026-05-25 23:59:59'),
    ('dota_arjun', 'Dota 2',                     'Nexus Dota',     'Ancient+',  'Hard Carry','South Asia', 'Nexus Dota needs a reliable position 1 carry. We scrim 4 nights a week.',                                     'open', NULL)
) AS fp(username, game_name, team_name, rank_required, role_required, region, description, status, deadline)
JOIN users u  ON u.username   = fp.username
JOIN games g  ON g.game_name  = fp.game_name
JOIN teams te ON te.team_name = fp.team_name
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 15. TEAM FINDER APPLICATIONS
-- =============================================================================

INSERT INTO team_finder_applications (post_id, user_id, message, status)
SELECT tfp.post_id, u.user_id, app.message, app.status
FROM (VALUES
    ('Valorant',                   'val_ananya', 'cs_vikram',
     'I main Jett and Neon at Plat 3. Available every weekday after 8 PM IST. Let''s grind!',
     'pending'),
    ('Battlegrounds Mobile India', 'sniper_raj', 'ff_meera',
     'I play Free Fire mainly but I''m Heroic in BGMI too. I can adapt to assault or support roles.',
     'draft_accepted')
) AS app(game_name, poster, applicant, message, status)
JOIN team_finder_posts tfp ON tfp.game_id = (SELECT game_id FROM games  WHERE game_name = app.game_name LIMIT 1)
                          AND tfp.user_id  = (SELECT user_id FROM users  WHERE username  = app.poster    LIMIT 1)
JOIN users u ON u.username = app.applicant
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 16. STREAMS
-- =============================================================================

INSERT INTO streams (user_id, game_id, platform, stream_url, title, status, viewer_count, started_at)
SELECT u.user_id, g.game_id, s.platform, s.stream_url, s.title, s.status, s.viewer_count,
       NOW() - (s.hours_ago || ' hours')::INTERVAL
FROM (VALUES
    ('apex_priya', 'Apex Legends',               'youtube', 'https://youtube.com/live/apexpriya', 'Diamond Push — Watch me cook!',      'live',  342, 0),
    ('cs_vikram',  'Counter-Strike',             'twitch',  'https://twitch.tv/cs_vikram',         'Faceit MM grind — come chat!',       'live',  128, 1),
    ('sniper_raj', 'Battlegrounds Mobile India', 'youtube', 'https://youtube.com/live/sniperraj',  'BGMI Pro League practice stream',    'ended', 0,   3),
    ('dota_arjun', 'Dota 2',                     'twitch',  'https://twitch.tv/dota_arjun',         'Coaching session — 7k behavior',     'ended', 0,   6)
) AS s(username, game_name, platform, stream_url, title, status, viewer_count, hours_ago)
JOIN users u ON u.username  = s.username
JOIN games g ON g.game_name = s.game_name
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 17. ACHIEVEMENTS
-- =============================================================================

INSERT INTO achievements (name, description, icon) VALUES
('First Blood',      'Won your first tournament match.',               '🏹'),
('Champion',         'Won a tournament.',                              '🏆'),
('Social Butterfly', 'Reached 50 followers.',                         '🦋'),
('Team Player',      'Joined your first team.',                       '🤝'),
('Veteran',          'Played over 1000 ranked matches on any game.',  '⚔️'),
('Streamer',         'Gone live on ArenaX for the first time.',        '📡'),
('Community Star',   'Your post received 50+ upvotes.',               '⭐'),
('Scout',            'Applied to 5 team finder listings.',             '🔍')
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- 18. USER ACHIEVEMENTS
-- =============================================================================

INSERT INTO user_achievements (user_id, achievement_id)
SELECT u.user_id, a.achievement_id
FROM (VALUES
    ('cs_vikram',  'First Blood'),
    ('cs_vikram',  'Team Player'),
    ('sniper_raj', 'Team Player'),
    ('sniper_raj', 'Veteran'),
    ('val_ananya', 'Team Player'),
    ('apex_priya', 'Streamer'),
    ('apex_priya', 'Team Player'),
    ('dota_arjun', 'Veteran'),
    ('dota_arjun', 'Team Player'),
    ('ff_meera',   'Community Star')
) AS ua(username, achievement_name)
JOIN users        u ON u.username = ua.username
JOIN achievements a ON a.name     = ua.achievement_name
ON CONFLICT (user_id, achievement_id) DO NOTHING;


-- =============================================================================
-- 19. NOTIFICATIONS
-- =============================================================================

INSERT INTO notifications (user_id, type, message, related_id, is_read)
SELECT u.user_id, n.type, n.message, NULL, n.is_read
FROM (VALUES
    ('sniper_raj', 'tournament',   'BGMI Pro League — April has started! Good luck Storm Riders.', FALSE),
    ('val_ananya', 'team_invite',  'cs_vikram applied to your Team Finder post for ArenaX Alpha.', FALSE),
    ('apex_priya', 'follow',       'sniper_raj started following you.',                            TRUE),
    ('cs_vikram',  'achievement',  'You earned the "First Blood" achievement!',                    TRUE),
    ('dota_arjun', 'match_result', 'Nexus Dota won 2-0 vs ArenaX Alpha in Dota 2 Winter Invitational.', TRUE)
) AS n(username, type, message, is_read)
JOIN users u ON u.username = n.username
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 20. MATCH PLAYER STATS
-- =============================================================================

INSERT INTO match_player_stats (match_id, user_id, kills, deaths, assists, damage, mvp)
SELECT m.match_id, u.user_id, s.kills, s.deaths, s.assists, s.damage, s.mvp
FROM (VALUES
    ('Dota 2 Winter Invitational', 'dota_arjun', 3, 1, 18, 12400, TRUE),
    ('Dota 2 Winter Invitational', 'lol_deepa',  1, 4,  9,  4200, FALSE)
) AS s(tournament_name, username, kills, deaths, assists, damage, mvp)
JOIN tournaments t ON t.name          = s.tournament_name
JOIN matches     m ON m.tournament_id = t.tournament_id
JOIN users       u ON u.username      = s.username
ON CONFLICT (match_id, user_id) DO NOTHING;


-- =============================================================================
-- 21. DIRECT MESSAGES
-- =============================================================================

INSERT INTO messages (sender_id, receiver_id, content, read_status)
SELECT u1.user_id, u2.user_id, msg.content, msg.read_status
FROM (VALUES
    ('val_ananya', 'cs_vikram',  'Hey! We need to schedule scrims for the Valorant Open. Free this weekend?', FALSE),
    ('cs_vikram',  'val_ananya', 'Yeah Saturday works. I''ll set up the 5 stack. What time?',                  FALSE),
    ('apex_priya', 'sniper_raj', 'Nice stream last night! Want to duo rank sometime?',                         TRUE)
) AS msg(sender, receiver, content, read_status)
JOIN users u1 ON u1.username = msg.sender
JOIN users u2 ON u2.username = msg.receiver
ON CONFLICT DO NOTHING;


-- =============================================================================
-- 22. AI RECOMMENDATIONS
-- =============================================================================

INSERT INTO ai_recommendations (user_id, type, data)
SELECT u.user_id, 'tournament', jsonb_build_object(
    'recommended_tournament', 'ArenaX Valorant Open S1',
    'reason', 'Based on your Valorant Platinum rank and active team membership.',
    'confidence', 0.91
)
FROM users u WHERE u.username = 'val_ananya'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- OPTIONAL: Verify row counts after seeding
-- =============================================================================
-- SELECT tablename, n_live_tup AS rows
-- FROM pg_stat_user_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

COMMIT;

-- =============================================================================
-- DEPLOY ORDER
-- =============================================================================
--  1.  psql -d your_db -f arenaX_schema.sql
--  2.  psql -d your_db -f arenaX_seed.sql
--  3.  psql -d your_db -f arenaX_archive_schema.sql  (optional archive system)
--  4.  npm run dev  (backend reads games.json and upserts via /api/games/sync)
-- =============================================================================
