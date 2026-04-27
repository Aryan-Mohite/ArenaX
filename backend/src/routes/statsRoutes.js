/**
 * statsRoutes.js
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
router.get("/valorant/:name/:tag",    getValorantStats);
router.get("/lol/:name/:tag",         getLolStats);
router.get("/lol/:name",              getLolStats);      // tag optional
router.get("/fortnite/:username",     getFortniteStats);
router.get("/dota2/:steamId",         getDota2Stats);
router.get("/apex/:username",         getApexStats);
router.get("/pubg/:username",         getPubgStats);
router.get("/r6/:username",           getR6Stats);
router.get("/steam/:steamId",         getSteamStats);    // CS2 via Steam ID
router.get("/brawlstars/:tag",        getBrawlStarsStats);
router.get("/rocketleague/:username", getRocketLeagueStats);
router.get("/cod/:username",          getCodStats);      // CoD Warzone (PC)

// ── Mobile (informational — no public API exists) ─────────────────────────────
router.get("/bgmi/:username",         getBgmiStats);
router.get("/freefire/:username",     getFreefireStats);
router.get("/codmobile/:username",    getCodMobileStats);
router.get("/mlbb/:playerId",         getMlbbStats);
router.get("/easportsfc/:username",   getEaSportsFcStats);

export default router;