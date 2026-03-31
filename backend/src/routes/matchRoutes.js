import { Router } from "express";
import {
  findMatchForUser,
  submitMatchResult,
  getMatch,
  submitPlayerStats,
} from "../controllers/matchController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// POST /api/matches/find  — ELO-based matchmaking
router.post(
  "/find",
  authMiddleware,
  [body("game_id").notEmpty().isInt({ min: 1 })],
  validate,
  findMatchForUser
);

// POST /api/matches/result  — record match result + update ELO
router.post(
  "/result",
  authMiddleware,
  [
    body("match_id").notEmpty().isInt({ min: 1 }),
    body("winner_team_id").notEmpty().isInt({ min: 1 }),
    body("score").optional().isString(),
  ],
  validate,
  submitMatchResult
);

// GET /api/matches/:id
router.get("/:id", validateIdParam, validate, getMatch);

// POST /api/matches/:id/stats
router.post(
  "/:id/stats",
  authMiddleware,
  validateIdParam,
  [body("stats").isArray({ min: 1 })],
  validate,
  submitPlayerStats
);

export default router;
