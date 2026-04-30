

// =============================================================================
// Full src/app.js for reference (complete file with changes applied)
// =============================================================================

import express from "express";
import cors from "cors";

import authRoutes      from "./routes/authRoutes.js";
import userRoutes      from "./routes/userRoutes.js";
import gameRoutes      from "./routes/gameRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamRoutes      from "./routes/teamRoutes.js";
import teamFinderRoutes from "./routes/teamFinderRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import messageRoutes   from "./routes/messageRoutes.js";
import streamRoutes    from "./routes/streamRoutes.js";
import matchRoutes     from "./routes/matchRoutes.js";
import statsRoutes     from "./routes/statsRoutes.js";
import archiveRoutes   from "./routes/archiveRoutes.js";          

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

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

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

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
app.use("/api/archive",     archiveRoutes);                       // ← ADD THIS

// ─── ERROR HANDLING (must be last) ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;


// =============================================================================
// FINAL ARCHIVE-AWARE DELETE ENDPOINTS SUMMARY
// =============================================================================
// Old route          →  New route (same HTTP method, different path prefix)
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tournaments/:id        →  DELETE /api/archive/tournaments/:id
// DELETE /api/teams/:id              →  DELETE /api/archive/teams/:id
// DELETE /api/streams/:id            →  DELETE /api/archive/streams/:id
// DELETE /api/communities/posts/:id  →  DELETE /api/archive/community/posts/:id
// DELETE /api/teamfinder/posts/:id   →  DELETE /api/archive/teamfinder/posts/:id
// DELETE /api/users/me               →  DELETE /api/archive/users/me
//
// Admin endpoints:
// GET    /api/archive/admin/archives
// GET    /api/archive/admin/archives/audit
// GET    /api/archive/admin/archives/:entity/:id
// POST   /api/archive/admin/archives/restore/tournament/:id
// POST   /api/archive/admin/archives/restore/team/:id
// POST   /api/archive/admin/archives/restore/stream/:id
// DELETE /api/archive/admin/archives/purge
//
// NOTE: isAdmin checks req.user.isAdmin. Make sure your JWT payload includes
//       isAdmin: true for admin users. If you don't have this yet, add it to
//       your login handler:
//         const isAdmin = user.email === process.env.ADMIN_EMAIL;
//         const token = generateToken({ id: user.user_id, isAdmin });
// =============================================================================