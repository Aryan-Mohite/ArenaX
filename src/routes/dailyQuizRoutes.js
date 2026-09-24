import { Router } from "express";
import {
  getMyDailiesGames,
  getGameLobby,
  startDailyQuiz,
  answerQuestion,
  forfeitOnBlur,
  getGameLeaderboard,
  getSessionShareData,
  bulkImportQuestions,
} from "../controllers/dailyQuizController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/requireAdmin.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// All Dailies routes are personalized (favourite games, streaks, sessions) —
// require auth throughout, same pattern as achievementRoutes.
router.use(authMiddleware);

// ─── Sidebar ────────────────────────────────────────────────────────────────
// GET /api/dailies/games — "Your Games" list w/ streaks + today's status
router.get("/games", getMyDailiesGames);

// ─── Per-game ──────────────────────────────────────────────────────────────
router.get(
  "/:game_id/lobby",
  [param("game_id").isInt({ min: 1 })],
  validate,
  getGameLobby
);

router.post(
  "/:game_id/start",
  [param("game_id").isInt({ min: 1 })],
  validate,
  startDailyQuiz
);

router.get(
  "/:game_id/leaderboard",
  [param("game_id").isInt({ min: 1 })],
  validate,
  getGameLeaderboard
);

// ─── Session ────────────────────────────────────────────────────────────────
router.post(
  "/session/:session_id/answer",
  [
    param("session_id").isInt({ min: 1 }),
    body("selected_option").optional({ nullable: true }).isIn(["a", "b", "c", "d"]),
  ],
  validate,
  answerQuestion
);

router.post(
  "/session/:session_id/blur",
  [param("session_id").isInt({ min: 1 })],
  validate,
  forfeitOnBlur
);

router.get(
  "/session/:session_id/share",
  [param("session_id").isInt({ min: 1 })],
  validate,
  getSessionShareData
);

// ─── Admin: question bank management ───────────────────────────────────────
// POST /api/dailies/admin/questions/bulk — see scripts/importDailyQuestions.js
router.post(
  "/admin/questions/bulk",
  requireAdmin,
  [
    body("game_id").isInt({ min: 1 }),
    body("questions").isArray({ min: 1 }),
  ],
  validate,
  bulkImportQuestions
);

export default router;
