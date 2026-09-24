import { Router } from "express";
import {
  getGames,
  getGameById,
  getMyGames,
  addFavouriteGame,
  removeFavouriteGame,
  syncGamesFromJson,
} from "../controllers/gameController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/games?genre=&q=&platform=
router.get("/", getGames);

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

// ─── Sync from local JSON (admin / first-time setup) ─────────────────────────
// POST /api/games/sync
router.post("/sync", syncGamesFromJson);

// ─── Parameterised routes (must come after named sub-paths) ──────────────────

// GET /api/games/:id
router.get("/:id", validateIdParam, validate, getGameById);

export default router;
