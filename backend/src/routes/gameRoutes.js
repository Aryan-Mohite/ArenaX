import { Router } from "express";
import {
  getGames,
  getGameById,
  getMyGames,
  addFavouriteGame,
  removeFavouriteGame,
} from "../controllers/gameController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// GET /api/games?genre=&q=
router.get("/", getGames);

// GET /api/games/my  — user's favourite games (auth required)
router.get("/my", authMiddleware, getMyGames);

// GET /api/games/:id
router.get("/:id", validateIdParam, validate, getGameById);

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

export default router;
