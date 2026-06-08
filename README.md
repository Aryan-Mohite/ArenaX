<div align="center">

<img src="Arena X Logo.png" alt="ArenaX Logo" width="180"/>

# ArenaX

**A full-stack esports platform for gamers — find teammates, compete in tournaments, and connect with communities.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](#license)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Real-Time Events (Socket.io)](#real-time-events-socketio)
- [Security](#security)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

ArenaX is a community-driven esports web platform designed for competitive gamers. It brings together tournament management, team coordination, live streaming, and social features into a single, unified experience — built from the ground up as a full-stack application with a focus on performance and security.

The platform supports multiple popular titles including Valorant, BGMI, Free Fire, PUBG, CS2, Mobile Legends, Dota 2, Apex Legends, and more.

---

## Screenshots

> _Screenshots coming soon — drop yours in a PR!_

| Page | Preview |
|------|---------|
| Home | `docs/screenshots/home.png` |
| Tournament Bracket | `docs/screenshots/tournament.png` |
| Team Finder | `docs/screenshots/teamfinder.png` |
| Communities | `docs/screenshots/communities.png` |
| Admin Dashboard | `docs/screenshots/admin.png` |
| User Profile | `docs/screenshots/profile.png` |

---

## Features

### For Players
- **Authentication** — Register, login, OTP-based email verification, and password reset via email
- **User Profiles** — Customizable profiles with avatar, bio, country/region, and per-game stats (rank, role, win rate, ELO)
- **Game Catalog** — Browse supported titles with cover art, descriptions, and platform info
- **Player Stats** — View match history, win rates, and game-specific performance metrics

### Tournament System
- Create and join tournaments with configurable formats
- Live bracket updates via WebSocket — changes pushed to all participants instantly
- Tournament registration and match tracking
- Archive system that soft-deletes and snapshots tournament data before removal

### Team Finder
- Post looking-for-group (LFG) listings specifying game, role, rank, and availability
- Browse and apply to open team finder posts
- Share listings via Web Share API (with clipboard fallback)

### Teams
- Create and manage teams with member roles
- Send and respond to team invitations
- Team profiles with member roster

### Communities
- Game-specific community forums with posts, comments, and voting
- Post sharing and moderation
- Community stats and activity feeds

### Real-Time Chat & Messaging
- Direct messaging between users, persisted to the database
- Live stream chat rooms scoped to active streams
- Online/offline presence indicators

### Live Streaming
- Create stream sessions with embed support
- Viewer join/leave events
- In-stream chat (rate-limited)

### Admin Dashboard
- User management — search, ban, unban, and soft-delete accounts
- Content moderation — review and remove community posts
- Archive dashboard to browse and restore soft-deleted records (tournaments, posts, streams, teams, matches)
- Audit log of all archival actions

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 (ES Modules) |
| Framework | Express 4 |
| Database | MySQL 8.0 via `mysql2` |
| Real-time | Socket.io 4 |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Email | Nodemailer (SMTP) |
| Security | Helmet (CSP), CORS, express-rate-limit, express-validator, sanitize-html |
| Process Manager | PM2 (production) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build Tool | Vite 5 |
| Routing | React Router v6 |
| Styling | Tailwind CSS 3 |
| HTTP Client | Axios |
| Real-time | Socket.io-client 4 |

### Infrastructure
- **Web Server** — Nginx (reverse proxy + static file serving + WebSocket support)
- **SSL** — Let's Encrypt via Certbot
- **Deployment** — PM2 ecosystem config for zero-downtime restarts

---

## Project Structure

```
ArenaX/
├── backend/
│   ├── server.js                  # Entry point — HTTP server + Socket.io init
│   ├── database/
│   │   └── arenaX_schema_mysql.sql  # Full MySQL schema (idempotent)
│   ├── data/
│   │   └── games.json             # Seed data for game catalog
│   ├── src/
│   │   ├── app.js                 # Express app — middleware & route mounting
│   │   ├── socket.js              # Socket.io server — events & auth
│   │   ├── config/
│   │   │   ├── db.js              # MySQL connection pool + auth cache
│   │   │   └── env.js             # Environment loader
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── gameController.js
│   │   │   ├── tournamentController.js
│   │   │   ├── teamController.js
│   │   │   ├── teamFinderController.js
│   │   │   ├── communityController.js
│   │   │   ├── messageController.js
│   │   │   ├── streamController.js
│   │   │   ├── matchController.js
│   │   │   ├── statsController.js
│   │   │   ├── adminController.js
│   │   │   └── archiveController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js  # JWT verify + DB status check + in-memory cache
│   │   │   ├── requireAdmin.js    # Live DB-verified admin check
│   │   │   ├── errorMiddleware.js
│   │   │   └── validateMiddleware.js
│   │   ├── routes/                # One file per resource
│   │   ├── services/
│   │   │   ├── matchmakingService.js
│   │   │   ├── tournamentService.js
│   │   │   └── gameDataService.js
│   │   └── utils/
│   │       ├── jwt.js
│   │       ├── mailer.js
│   │       ├── otp.js
│   │       ├── sanitize.js
│   │       └── validators.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── public/                    # Game cover images, avatars, icons
│   └── src/
│       ├── App.jsx                # Router + layout
│       ├── main.jsx
│       ├── index.css              # Global styles + CSS custom properties
│       ├── api/
│       │   └── api.js             # Axios instance with base URL + auth header
│       ├── context/
│       │   ├── AuthContext.jsx    # JWT-backed auth state
│       │   └── ThemeContext.jsx   # Dark/light theme toggle
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── GameCard.jsx
│       │   ├── TournamentCard.jsx
│       │   ├── TeamFinderCard.jsx
│       │   ├── PlayerProfileModal.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── AdminRoute.jsx
│       │   ├── Loader.jsx
│       │   └── CustomCursor.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Games.jsx
│       │   ├── Tournament.jsx
│       │   ├── TeamFinder.jsx
│       │   ├── Communities.jsx
│       │   ├── Stream.jsx
│       │   ├── Profile.jsx
│       │   ├── UserProfile.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── ForgotPassword.jsx
│       │   ├── About.jsx
│       │   ├── TermsAndConditions.jsx
│       │   ├── PrivacyPolicy.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx
│       │       └── AdminArchiveDashboard.jsx
│       ├── services/              # API call wrappers per feature
│       ├── hooks/
│       │   └── useImageUpload.js
│       └── utils/
│           └── themeStyles.js
│
├── deploy/
│   ├── DEPLOY.md                  # Step-by-step production guide
│   ├── ecosystem.config.cjs       # PM2 config
│   └── nginx.conf                 # Nginx reverse proxy + SSL template
│
└── .gitignore
```

---

## Database Schema

The full schema lives at `backend/database/arenaX_schema_mysql.sql` and is idempotent — safe to re-run on an existing database.

**Core tables:**

| Group | Tables |
|-------|--------|
| Users & Auth | `users`, `pending_verifications`, `password_resets` |
| Games | `games`, `user_game_profile` |
| Social | `user_follows`, `friendships`, `messages`, `notifications` |
| Teams | `teams`, `team_members`, `team_invitations` |
| Team Finder | `team_finder_posts`, `team_finder_applications` |
| Tournaments | `tournaments`, `tournament_registrations`, `tournament_organizers`, `matches`, `match_player_stats` |
| Communities | `communities`, `community_posts`, `post_comments`, `post_votes` |
| Streaming | `streams` |
| Gamification | `achievements`, `user_achievements` |
| Moderation | `reports`, `deleted_users_log` |
| Archive | `archive_tournaments`, `archive_team_finder_posts`, `archive_streams`, `archive_community_posts`, `archive_teams`, `archive_matches`, `archive_audit_log`, `archive_config` |

Archive tables use MySQL triggers to snapshot rows as JSON before deletion, providing a full soft-delete + restore system.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0
- **MySQL** 8.0+
- **npm** or **yarn**

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/arenaX.git
cd arenaX/backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — fill in DB credentials, JWT secret, SMTP settings, etc.

# 4. Create the database
mysql -u root -p -e "CREATE DATABASE esports_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. Import the schema
mysql -u root -p esports_platform < database/arenaX_schema_mysql.sql

# 6. Start the dev server
npm run dev
# Server starts at http://localhost:5000
```

### Frontend Setup

```bash
cd arenaX/frontend

# 1. Install dependencies
npm install

# 2. Configure environment (optional for local dev)
cp .env.example .env.local
# Set VITE_API_URL if backend is not on localhost:5000

# 3. Start the dev server
npm run dev
# App starts at http://localhost:5173
```

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` |
| `DB_HOST` | ✅ | MySQL host |
| `DB_PORT` | No | MySQL port (default: `3306`) |
| `DB_USER` | ✅ | MySQL username |
| `DB_PASSWORD` | ✅ | MySQL password |
| `DB_NAME` | ✅ | Database name |
| `JWT_SECRET` | ✅ | Long random secret — generate with `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `7d`) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated list of allowed frontend origins |
| `ADMIN_EMAILS` | ✅ | Comma-separated admin email addresses |
| `SMTP_HOST` | ✅ | SMTP server host |
| `SMTP_PORT` | ✅ | SMTP port (usually `587`) |
| `SMTP_USER` | ✅ | SMTP username / email |
| `SMTP_PASS` | ✅ | SMTP password or app password |
| `HENRIKDEV_KEY` | No | HenrikDev API key (Valorant stats) |
| `TRACKER_GG_KEY` | No | Tracker.gg API key |

> **Never commit `.env` to version control.** Use `.env.example` as the template.

### Frontend — `frontend/.env.production`

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (e.g. `https://api.yourdomain.com/api`). Leave empty if served from the same origin via Nginx. |
| `VITE_SOCKET_URL` | Socket.io server URL. Defaults to same origin as the API. |

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

| Route Prefix | Description | Auth |
|---|---|---|
| `POST /api/auth/register` | Create account + send OTP | Public |
| `POST /api/auth/verify-email` | Verify email with OTP | Public |
| `POST /api/auth/login` | Login, returns JWT | Public |
| `POST /api/auth/forgot-password` | Send password reset email | Public |
| `POST /api/auth/reset-password` | Reset password with token | Public |
| `/api/users` | Profile read/update, follows, friends | Protected |
| `/api/games` | Game catalog CRUD | Public / Admin |
| `/api/tournaments` | Tournament create, join, bracket | Mixed |
| `/api/teams` | Team management, invitations | Protected |
| `/api/teamfinder` | LFG posts and applications | Mixed |
| `/api/communities` | Posts, comments, votes | Mixed |
| `/api/messages` | Direct message history | Protected |
| `/api/streams` | Stream session management | Protected |
| `/api/matches` | Match results and stats | Protected |
| `/api/stats` | Player and platform statistics | Mixed |
| `/api/admin` | User/content moderation | Admin only |
| `/api/archive` | Soft-delete archive and restore | Admin only |
| `GET /health` | Health check | Public |

Rate limits: auth endpoints are capped at **10 requests / 15 minutes**; all other API endpoints at **120 requests / minute**.

---

## Real-Time Events (Socket.io)

Socket connections require a valid JWT passed in `socket.handshake.auth.token`. The server verifies the token and checks the account is active before allowing the connection.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `go_online` | — | Broadcast presence to other users |
| `send_message` | `{ receiverId, content }` | Send a direct message |
| `join_stream` | `{ streamId }` | Join a stream chat room |
| `leave_stream` | `{ streamId }` | Leave a stream chat room |
| `stream_chat` | `{ streamId, message }` | Send a stream chat message |
| `join_tournament` | `{ tournamentId }` | Subscribe to bracket updates |
| `match_update` | `{ tournamentId, matchData }` | Push bracket update (admin only) |
| `join_queue` | `{ gameId }` | Enter matchmaking queue |
| `leave_queue` | `{ gameId }` | Exit matchmaking queue |

### Server → Client

| Event | Description |
|-------|-------------|
| `user_online` / `user_offline` | Presence updates |
| `new_message` | Incoming direct message |
| `message_sent` | Confirmation of sent message |
| `stream_chat_message` | Incoming stream chat message |
| `viewer_joined` / `viewer_left` | Stream viewer updates |
| `bracket_updated` | Live tournament bracket change |
| `queue_joined` | Matchmaking queue confirmation |

Socket messages are rate-limited to **60 events / minute per user**. Message length is capped at 2,000 characters for DMs and 500 for stream chat.

---

## Security

ArenaX was built with security as a first-class concern:

- **Helmet** — Sets strict HTTP security headers including a hand-tuned Content Security Policy (no `unsafe-eval`, no wildcard origins)
- **CORS** — Strict allowlist; only origins in `ALLOWED_ORIGINS` are accepted
- **JWT + DB verification** — Every authenticated request verifies the token _and_ checks the user is still active in the database. Banned or deleted accounts are rejected immediately.
- **Admin verification** — Admin middleware performs a live DB lookup against `ADMIN_EMAILS` on every request; a forged `isAdmin` JWT claim grants no access
- **Auth cache** — In-memory cache (60 s TTL) reduces DB load on the hot auth path; cache entries are evicted instantly when a user is banned or deleted
- **Rate limiting** — Separate limits for auth routes (brute-force protection) and general API routes
- **Socket rate limiting** — Per-user event counters with automatic stale-entry pruning
- **Input validation** — `express-validator` on all inputs; user-generated HTML is sanitized with `sanitize-html` before storage
- **Password hashing** — bcrypt with a work factor suitable for production
- **OTP email verification** — New accounts are verified via a time-limited OTP before full access is granted
- **Graceful shutdown** — SIGTERM/SIGINT handlers drain the DB connection pool cleanly

---

## Deployment

A complete production deployment guide is available at [`deploy/DEPLOY.md`](deploy/DEPLOY.md). It covers:

1. Ubuntu server provisioning
2. MySQL database setup and schema import
3. Backend installation and `.env` configuration
4. Frontend build (`npm run build` → `dist/`)
5. Nginx reverse proxy configuration with WebSocket support
6. SSL certificate issuance via Certbot
7. PM2 process management and auto-start on reboot
8. Ongoing maintenance (deploy updates, log rotation, DB backups)

A ready-to-use Nginx config is at [`deploy/nginx.conf`](deploy/nginx.conf) and a PM2 ecosystem file is at [`deploy/ecosystem.config.cjs`](deploy/ecosystem.config.cjs).

### Pre-launch Checklist

- [ ] All credentials rotated and stored only in `.env`
- [ ] `JWT_SECRET` generated with `openssl rand -hex 64`
- [ ] `NODE_ENV=production` set in PM2 config
- [ ] `ALLOWED_ORIGINS` restricted to production frontend URL
- [ ] SSL certificate active
- [ ] Database user has minimal permissions (not root)
- [ ] DB backups scheduled
- [ ] Log rotation configured

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m "feat: add your feature"`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please keep PRs focused — one feature or fix per PR. For larger changes, open an issue first to discuss the approach.

---

## License

This project is licensed under the **ISC License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

Built by [Aryan](https://github.com/your-username) · Walchand College of Engineering, Sangli

</div>
