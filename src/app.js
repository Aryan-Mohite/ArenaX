import "./config/env.js";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import cors from "cors";
// SEO ADD 1: gzip compression — reduces page size, improves Core Web Vitals LCP
import compression from "compression";

import authRoutes       from "./routes/authRoutes.js";
import userRoutes       from "./routes/userRoutes.js";
import gameRoutes       from "./routes/gameRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamRoutes       from "./routes/teamRoutes.js";
import teamFinderRoutes from "./routes/teamFinderRoutes.js";
import communityRoutes  from "./routes/communityRoutes.js";
import streamRoutes     from "./routes/streamRoutes.js";
import matchRoutes      from "./routes/matchRoutes.js";
import archiveRoutes    from "./routes/archiveRoutes.js";
import adminRoutes      from "./routes/adminRoutes.js";
import chatRoutes       from "./routes/chatRoutes.js";
import gamerDnaRoutes   from "./routes/gamerDnaRoutes.js";
import achievementRoutes from "./routes/achievementRoutes.js";
import dailyQuizRoutes   from "./routes/dailyQuizRoutes.js";
import platformRoutes    from "./routes/platformRoutes.js";
import paymentRoutes     from "./routes/paymentRoutes.js";
import organizerRoutes   from "./routes/organizerRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// ─── TRUST PROXY ──────────────────────────────────────────────────────────────
app.set("trust proxy", 1);

// SEO ADD 2: gzip all responses — must be near the top, before routes
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : "*", credentials: true }));

// SEO ADD 3: www → non-www canonical redirect
// Prevents duplicate content between www.arenax.io and arenax.io
app.use((req, res, next) => {
  if (req.headers.host && req.headers.host.startsWith("www.")) {
    const canonical = req.headers.host.replace(/^www\./, "");
    return res.redirect(301, `https://${canonical}${req.url}`);
  }
  next();
});

// ─── SECURITY HEADERS (Helmet) ────────────────────────────────────────────────
// SEO FIX: Previous CSP blocked GTM and GA scripts from loading.
// scriptSrc and connectSrc now include Google Tag Manager and Analytics domains.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          // SEO FIX: These were missing — GTM and GA were being blocked by CSP
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://ssl.google-analytics.com",
        ],
        styleSrc:    ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:",
          // SEO FIX: GA tracking pixels need these
          "https://www.google-analytics.com",
          "https://www.googletagmanager.com",
        ],
        connectSrc: [
          "'self'",
          // SEO FIX: GA data collection endpoints
          "https://www.google-analytics.com",
          "https://analytics.google.com",
          "https://stats.g.doubleclick.net",
          "https://region1.google-analytics.com",
        ],
        mediaSrc:    ["'self'", "blob:", "https:"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// SEO ADD 4: Cache headers for static assets and HTML
// Proper caching improves Core Web Vitals and reduces server load
app.use((req, res, next) => {
  if (/\.(css|js|png|jpg|jpeg|gif|ico|woff2|woff|ttf|svg|webp)$/.test(req.path)) {
    // Immutable assets (Vite hashes filenames) — cache for 1 year
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (req.path === "/" || req.path.endsWith(".html")) {
    // HTML — revalidate every hour
    res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
  } else if (req.path === "/sitemap.xml" || req.path === "/robots.txt") {
    // SEO files — cache for 1 day
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
  next();
});

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts — please try again in 15 minutes" },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests — please slow down" },
  skip: (req) => req.path.startsWith("/auth"),
});

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
// `verify` stashes the raw request body on req.rawBody — needed by the
// Razorpay webhook handler to check the HMAC signature, which must be
// computed over the exact bytes received, not the re-serialized JSON.
app.use(express.json({
  limit: "5mb",
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || "not set",
    port: process.env.PORT || "not set (using 5000)",
    db: { host: process.env.DB_HOST || "not set", user: process.env.DB_USER || "not set", name: process.env.DB_NAME || "not set" },
    envVars: {
      DB_HOST:      !!process.env.DB_HOST,
      DB_USER:      !!process.env.DB_USER,
      DB_NAME:      !!process.env.DB_NAME,
      DB_PASSWORD:  !!process.env.DB_PASSWORD,
      JWT_SECRET:   !!process.env.JWT_SECRET,
    }
  };
  try {
    const pool = (await import("./config/db.js")).default;
    const conn = await pool.getConnection();
    conn.release();
    checks.dbConnection = "connected";
  } catch (e) {
    checks.dbConnection = "failed: " + e.message;
    checks.status = "degraded";
  }
  res.json(checks);
});

// ─── SEO ADD 5: robots.txt route ──────────────────────────────────────────────
// Placed before API routes and static files so it's always served correctly.
// Disallows API/auth routes from being crawled (saves crawl budget).
// GEO FIX (round 4): Removed the GPTBot block — it was preventing ChatGPT and
// other LLM crawlers from indexing ArenaX, directly hurting the GEO score.
// All major AI bots are now explicitly allowed to crawl the public site.
app.get("/robots.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Allow: /*.css$
Allow: /*.js$

# ── AI / LLM crawlers — explicitly allowed ──────────────────────────────────
# Blocking these hurts Generative Engine Optimization (GEO). Let them crawl.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: CCBot
Allow: /

Sitemap: https://arenax.io/sitemap.xml
LLMs: https://arenax.io/llms.txt
`);
});

// ─── GEO ADD 7: llms.txt route ────────────────────────────────────────────────
// llms.txt is a proposed standard (llmstxt.org) for giving LLM crawlers a
// structured, plain-text summary of a site — analogous to robots.txt but for
// AI. Because ArenaX is a React SPA (440% client-side rendering), LLMs that
// crawl the raw HTML shell see very little content. This file compensates by
// providing a canonical, crawlable description of every feature and page.
app.get("/llms.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(
`# ArenaX — Free Esports Tournaments & Team Finder Platform
> ArenaX (https://arenax.io) is a free, all-in-one esports platform for competitive FPS players. Players can find and enter free tournaments, build and manage teams, watch live streams, and connect with the gaming community — all in one place.

## Site Overview
- **Name:** ArenaX
- **URL:** https://arenax.io
- **Type:** Esports platform / competitive gaming hub
- **Audience:** Competitive FPS gamers, esports players, tournament organizers
- **Supported Games:** Valorant, Counter-Strike 2, League of Legends, Dota 2, Apex Legends, Fortnite, Call of Duty: Warzone, PUBG: Battlegrounds, Battlegrounds Mobile India (BGMI), Free Fire, Call of Duty: Mobile
- **Region:** Global, with focus on South Asia and worldwide FPS community
- **Cost:** Free to join. No credit card required.

## Core Features

### Tournaments (/tournament)
Players can browse and register for free online esports tournaments. Tournaments are organized by game, format, and prize pool. Entry is free. Upcoming and live tournaments are listed with team size, entry requirements, and schedule. Supported formats include 1v1, 5v5, and team-based brackets.

### Team Finder (/teamfinder)
A dedicated matchmaking tool for players looking for teammates. Users post their game, rank, role, and availability. Other players can browse and request to join. Built for FPS games like Valorant and CS2 where team composition matters. Helps solo players find squads for tournaments.

### Games (/games)
A directory of all games supported on ArenaX: Valorant, Counter-Strike 2, League of Legends, Dota 2, Apex Legends, Fortnite, Call of Duty: Warzone, PUBG: Battlegrounds, Battlegrounds Mobile India (BGMI), Free Fire, and Call of Duty: Mobile. Each game also has its own dedicated landing page at /games/<slug> with tournament info, team finder access, and an FAQ specific to that game — see the Game Pages list below.

### Live Streams (/stream)
Watch live esports streams directly on ArenaX. Streams are sourced from active tournaments and community players. Integrated stream viewer with no third-party redirect required.

### The Nexus — Communities (/communities)
Community hub for ArenaX players. Players can join game-specific communities, post updates, find events, and engage with other competitive gamers. Replaces traditional gaming forums with a focused esports community experience.

### About (/about)
Background on ArenaX, its mission, founding team, and platform values. ArenaX was founded in 2026 with the goal of making esports accessible and competitive for everyone.

### Blog (/blog)
Educational esports content covering tournament strategy, team building, streaming setup, competitive gaming guides, and esports career advice. Articles include:
- How to Join Valorant Tournaments Online
- Finding the Right Teammates for FPS Games
- Building a Streaming Setup on a Budget
- Understanding Tournament Formats Explained
- How to Use an Esports Team Finder to Build a Winning Squad
- Best Free Esports Tournaments in India (2026 Guide)
- Valorant vs CS2: Which Tactical Shooter Should You Compete In?
- How Esports Tournament Brackets Actually Work
- Battle Royale Esports in India: BGMI vs Free Fire vs PUBG
- How to Start an Esports Career in India: A Realistic Roadmap

## Key Pages
- Home: https://arenax.io/
- Tournaments: https://arenax.io/tournament
- Team Finder: https://arenax.io/teamfinder
- Games: https://arenax.io/games
- Live Streams: https://arenax.io/stream
- Communities: https://arenax.io/communities
- Blog: https://arenax.io/blog
- About: https://arenax.io/about
- Sign In: https://arenax.io/login
- Register: https://arenax.io/register

## Game Pages (/games/<slug>)
- Valorant: https://arenax.io/games/valorant
- Counter-Strike 2: https://arenax.io/games/counter-strike
- League of Legends: https://arenax.io/games/league-of-legends
- Dota 2: https://arenax.io/games/dota-2
- Apex Legends: https://arenax.io/games/apex-legends
- Fortnite: https://arenax.io/games/fortnite
- Call of Duty: Warzone: https://arenax.io/games/warzone
- PUBG: Battlegrounds: https://arenax.io/games/pubg-battlegrounds
- Battlegrounds Mobile India (BGMI): https://arenax.io/games/battlegrounds-mobile-india
- Free Fire: https://arenax.io/games/free-fire
- Call of Duty: Mobile: https://arenax.io/games/cod-mobile

## Technical
- Sitemap: https://arenax.io/sitemap.xml
- Robots: https://arenax.io/robots.txt

## Social / Contact
- Instagram: https://www.instagram.com/arenax_gg/
- X (Twitter): https://x.com/Official_ArenaX
- YouTube: https://www.youtube.com/@ArenaX_gg
- Twitch: https://www.twitch.tv/arenaxxtreme
`);
});

// Blog post slugs — keep in sync with frontend/src/data/blogPosts.js.
// The backend can't import frontend source directly, so this is a hardcoded
// mirror. When you add a new post to blogPosts.js, add its slug here too.
const BLOG_SLUGS = [
  "how-to-join-valorant-tournaments-online",
  "finding-the-right-teammates-fps-games",
  "building-a-streaming-setup-on-a-budget",
  "understanding-tournament-formats-explained",
  "esports-team-finder-guide",
  "free-esports-tournaments-india-2026",
  "valorant-vs-cs2-which-tactical-shooter-to-compete-in",
  "how-esports-tournament-brackets-work",
  "battle-royale-esports-guide-bgmi-free-fire-pubg",
  "how-to-start-esports-career-in-india",
];

// ─── SEO ADD 6: Dynamic sitemap.xml route ─────────────────────────────────────
// Dynamic so it can include live tournament pages from the DB.
// Falls back gracefully if DB is unavailable.
app.get("/sitemap.xml", async (_req, res) => {
  const baseUrl = "https://arenax.io";
  const today   = new Date().toISOString().split("T")[0];

  // Static pages — FIXED to match real routes in frontend/src/App.jsx
  const staticPages = [
    { url: "/",            priority: "1.0", changefreq: "weekly"  },
    { url: "/games",       priority: "0.9", changefreq: "weekly"  },
    { url: "/tournament",  priority: "0.9", changefreq: "daily"   },
    { url: "/teamfinder",  priority: "0.9", changefreq: "weekly"  },
    { url: "/stream",      priority: "0.8", changefreq: "daily"   },
    { url: "/communities", priority: "0.7", changefreq: "weekly"  },
    { url: "/about",       priority: "0.5", changefreq: "monthly" },
    { url: "/blog",        priority: "0.7", changefreq: "weekly"  },
    { url: "/faq",         priority: "0.6", changefreq: "monthly" },
  ];

  // Blog posts — static content, listed individually so each gets indexed.
  const blogPages = BLOG_SLUGS.map((slug) => ({
    url: `/blog/${slug}`,
    priority: "0.6",
    changefreq: "monthly",
  }));

  // Dynamic: pull live tournaments from DB for individual tournament URLs.
  // FIXED column names/values to match database/arenaX_schema_mysql.sql:
  //   tournament_id (not "id"), created_at (no updated_at column),
  //   status enum is upcoming/ongoing/completed/cancelled (no "active")
  let tournamentPages = [];
  try {
    const pool = (await import("./config/db.js")).default;
    const [rows] = await pool.query(
      "SELECT tournament_id, created_at FROM tournaments WHERE status IN ('upcoming','ongoing') LIMIT 200"
    );
    tournamentPages = rows.map((t) => ({
      // FIXED: route is /tournament/:id (singular), not /tournaments/:id
      url: `/tournament/${t.tournament_id}`,
      priority: "0.7",
      changefreq: "daily",
      lastmod: t.created_at
        ? new Date(t.created_at).toISOString().split("T")[0]
        : today,
    }));
  } catch (err) {
    // Sitemap still works if DB is down — just won't include tournament URLs
    console.warn("[sitemap] Could not fetch tournament pages:", err.message);
  }

  // Per-game landing pages (/games/:slug), added once GamePage.jsx + the
  // route existed. Read from the local games.json file rather than the DB:
  // the slug list is static content anyway (same source GamePage.jsx's
  // frontend copy is built from), so this avoids a DB dependency for pages
  // that don't need one and keeps the sitemap available even if the DB is
  // briefly down.
  let gamePages = [];
  try {
    // fs.readFileSync + JSON.parse rather than an ESM JSON import: import
    // attributes (`with { type: "json" }`) need Node 20.10+, but
    // package.json's engines field only guarantees >=18. readFileSync works
    // identically on every Node version this could run on (Hostinger, CI).
    const gamesJsonPath = path.join(__dirname, "..", "data", "games.json");
    const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, "utf-8"));
    gamePages = gamesData.map((g) => ({
      url: `/games/${g.slug}`,
      priority: "0.7",
      changefreq: "weekly",
    }));
  } catch (err) {
    console.warn("[sitemap] Could not read games.json for game pages:", err.message);
  }

  const allPages = [...staticPages, ...blogPages, ...tournamentPages, ...gamePages];

  const urlEntries = allPages
    .map(
      (p) => `
  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${p.lastmod || today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/users",       userRoutes);
app.use("/api/games",       gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams",       teamRoutes);
app.use("/api/teamfinder",  teamFinderRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/streams",     streamRoutes);
app.use("/api/matches",     matchRoutes);
app.use("/api/archive",     archiveRoutes);
app.use("/api/admin",       adminRoutes);
app.use("/api/chat",        chatRoutes);
app.use("/api/gamer-dna",   gamerDnaRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/dailies",      dailyQuizRoutes);
app.use("/api/platform",     platformRoutes);
app.use("/api/payments",     paymentRoutes);
app.use("/api/organizers",   organizerRoutes);

// ─── SERVE REACT FRONTEND (SPA) ───────────────────────────────────────────────
// Serves the Vite-built React app for all non-API routes.
// frontend/dist is populated by running: npm run build:frontend
const distPath = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(distPath));

// SPA fallback — any route not matched by the API returns index.html
// so React Router handles client-side navigation.
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ─── ERROR HANDLING (must come after all routes) ──────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
