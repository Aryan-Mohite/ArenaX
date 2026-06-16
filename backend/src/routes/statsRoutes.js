/**
 * statsRoutes.js
 * Mount in app.js:
 *   import statsRoutes from "./routes/statsRoutes.js";
 *   app.use("/api/stats", statsRoutes);
 */

import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
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
  getRocketLeagueStats,
  getCodStats,
  // Mobile (no-API informational)
  getBgmiStats,
  getFreefireStats,
  getCodMobileStats,
  getMlbbStats,
  getEaSportsFcStats,
} from "../controllers/statsController.js";

const router = Router();

// ── PC / Console (live API data) ──────────────────────────────────────────────
router.get("/valorant/:name/:tag",    authMiddleware, getValorantStats);
router.get("/lol/:name/:tag",         authMiddleware, getLolStats);
router.get("/lol/:name",              authMiddleware, getLolStats);      // tag optional
router.get("/fortnite/:username",     authMiddleware, getFortniteStats);
router.get("/dota2/:steamId",         authMiddleware, getDota2Stats);
router.get("/apex/:username",         authMiddleware, getApexStats);
router.get("/pubg/:username",         authMiddleware, getPubgStats);
router.get("/r6/:username",           authMiddleware, getR6Stats);
router.get("/steam/:steamId",         authMiddleware, getSteamStats);    // CS2 via Steam ID
router.get("/brawlstars/:tag",        authMiddleware, getBrawlStarsStats);
router.get("/rocketleague/:username", authMiddleware, getRocketLeagueStats);
router.get("/cod/:username",          authMiddleware, getCodStats);      // CoD Warzone (PC)

// ── Mobile (informational — no public API exists) ─────────────────────────────
router.get("/bgmi/:username",         authMiddleware, getBgmiStats);
router.get("/freefire/:username",     authMiddleware, getFreefireStats);
router.get("/codmobile/:username",    authMiddleware, getCodMobileStats);
router.get("/mlbb/:playerId",         authMiddleware, getMlbbStats);
router.get("/easportsfc/:username",   authMiddleware, getEaSportsFcStats);

export default router;
