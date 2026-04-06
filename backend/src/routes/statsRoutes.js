/**
 * statsRoutes.js
 * Server-side proxy routes for game stat APIs.
 * All external API calls are made from the backend — no CORS issues,
 * API keys stay securely in .env.
 *
 * Mount in app.js:
 *   import statsRoutes from "./routes/statsRoutes.js";
 *   app.use("/api/stats", statsRoutes);
 */

import { Router } from "express";
import {
  getValorantStats,
  getLolStats,
  getFortniteStats,
  getDota2Stats,
  getApexStats,
  getPubgStats,
  getR6Stats,
  getSteamStats,
  getBrawlStarsStats,
} from "../controllers/statsController.js";

const router = Router();

// Valorant  — GET /api/stats/valorant/:name/:tag
// e.g. /api/stats/valorant/Nexus%20Shivaay/7277
router.get("/valorant/:name/:tag", getValorantStats);

// League of Legends — GET /api/stats/lol/:name/:tag
router.get("/lol/:name/:tag", getLolStats);
router.get("/lol/:name",      getLolStats);   // tag optional

// Fortnite — GET /api/stats/fortnite/:username
router.get("/fortnite/:username", getFortniteStats);

// Dota 2 — GET /api/stats/dota2/:steamId
router.get("/dota2/:steamId", getDota2Stats);

// Apex Legends — GET /api/stats/apex/:username
router.get("/apex/:username", getApexStats);

// PUBG — GET /api/stats/pubg/:username
router.get("/pubg/:username", getPubgStats);

// Rainbow Six Siege — GET /api/stats/r6/:username
router.get("/r6/:username", getR6Stats);

// Counter-Strike / Steam — GET /api/stats/steam/:steamId
router.get("/steam/:steamId", getSteamStats);

// Brawl Stars — GET /api/stats/brawlstars/:tag
// tag can be with or without # (e.g. 2PP or %232PP)
router.get("/brawlstars/:tag", getBrawlStarsStats);

export default router;