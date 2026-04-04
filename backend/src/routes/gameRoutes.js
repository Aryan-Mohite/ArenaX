import { Router } from "express";
import {
  getGames,
  getGameById,
  getMyGames,
  addFavouriteGame,
  removeFavouriteGame,
  syncGamesFromRawg,
  rawgSearchProxy,
  rawgDetailsProxy,
} from "../controllers/gameController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param, query } from "express-validator";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/games?genre=&q=
router.get("/", getGames);

// GET /api/games/rawg/search?q=valorant  — proxy to RAWG (API key stays server-side)
router.get(
  "/rawg/search",
  [query("q").notEmpty().withMessage("Search query is required")],
  validate,
  rawgSearchProxy
);

// GET /api/games/rawg/:slug  — proxy RAWG game detail
router.get("/rawg/:slug", rawgDetailsProxy);

// ─── Auth-required routes ─────────────────────────────────────────────────────

// GET /api/games/my  — user's favourite games
router.get("/my", authMiddleware, getMyGames);

// POST /api/games/my  — add a favourite game
router.post(
  "/my",
  authMiddleware,
  [body("game_id").notEmpty().isInt({ min: 1 })],
  validate,
  addFavouriteGame
);

// DELETE /api/games/my/:game_id
router.delete(
  "/my/:game_id",
  authMiddleware,
  [param("game_id").isInt({ min: 1 })],
  validate,
  removeFavouriteGame
);

// ─── RAWG sync (admin / one-time setup) ───────────────────────────────────────
// POST /api/games/sync
// Fetches top 20 esports titles from RAWG and upserts into DB.
// Protect with X-Sync-Secret header in production (set RAWG_SYNC_SECRET in .env).
router.post("/sync", syncGamesFromRawg);

// ─── Parameterised routes (must come after named sub-paths) ──────────────────

// GET /api/games/:id
router.get("/:id", validateIdParam, validate, getGameById);

export default router;
