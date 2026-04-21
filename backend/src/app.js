import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import teamFinderRoutes from "./routes/teamFinderRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import streamRoutes from "./routes/streamRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
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
// 150 MB limit — supports high-quality base64 image uploads up to 100 MB
// (base64 inflates ~33%, so a 100 MB source image → ~133 MB payload, comfortably under limit)
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/teamfinder", teamFinderRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/streams", streamRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/stats",   statsRoutes);

// ─── ERROR HANDLING (must be last) ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;