import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import authRoutes       from "./routes/authRoutes.js";
import userRoutes       from "./routes/userRoutes.js";
import gameRoutes       from "./routes/gameRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamRoutes       from "./routes/teamRoutes.js";
import teamFinderRoutes from "./routes/teamFinderRoutes.js";
import communityRoutes  from "./routes/communityRoutes.js";
import messageRoutes    from "./routes/messageRoutes.js";
import streamRoutes     from "./routes/streamRoutes.js";
import matchRoutes      from "./routes/matchRoutes.js";
import statsRoutes      from "./routes/statsRoutes.js";
import archiveRoutes    from "./routes/archiveRoutes.js";
import adminRoutes      from "./routes/adminRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

// ─── TRUST PROXY ──────────────────────────────────────────────────────────────
app.set("trust proxy", 1);

// ─── SECURITY HEADERS (Helmet) ────────────────────────────────────────────────
// FIX M5: Explicit CSP instead of Helmet default.
// Default Helmet CSP blocks: inline React scripts, Google Fonts, Socket.io WS.
// Configured to allow exactly what ArenaX needs and nothing more.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

// Build wss:// equivalents for WebSocket CSP
const wsOrigins = allowedOrigins.map((o) => o.replace(/^https:/, "wss:").replace(/^http:/, "ws:"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc:      ["'self'", "data:", "https:", "blob:"],
        connectSrc:  ["'self'", ...allowedOrigins, ...wsOrigins],
        mediaSrc:    ["'self'", "blob:", "https:"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // allow embedded media (stream embeds)
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/users",       userRoutes);
app.use("/api/games",       gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams",       teamRoutes);
app.use("/api/teamfinder",  teamFinderRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/messages",    messageRoutes);
app.use("/api/streams",     streamRoutes);
app.use("/api/matches",     matchRoutes);
app.use("/api/stats",       statsRoutes);
app.use("/api/archive",     archiveRoutes);
app.use("/api/admin",       adminRoutes);

// ─── ERROR HANDLING (must be last) ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
