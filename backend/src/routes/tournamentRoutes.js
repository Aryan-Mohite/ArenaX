import { Router } from "express";
import {
  getTournaments,
  getTournamentById,
  createTournament,
  registerForTournament,
  updateTournamentStatus,
  // FIX M1: deleteTournament removed — archive-aware version lives in archiveRoutes.js
} from "../controllers/tournamentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCreateTournament, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body } from "express-validator";

const router = Router();

// GET /api/tournaments?game_id=&region=&status=&limit=&offset=
router.get("/", getTournaments);

// GET /api/tournaments/:id
router.get("/:id", validateIdParam, validate, getTournamentById);

// POST /api/tournaments
router.post("/", authMiddleware, validateCreateTournament, validate, createTournament);

// POST /api/tournaments/:id/register
router.post(
  "/:id/register",
  authMiddleware,
  validateIdParam,
  [body("team_id").notEmpty().isInt({ min: 1 })],
  validate,
  registerForTournament
);

// PATCH /api/tournaments/:id/status
router.patch(
  "/:id/status",
  authMiddleware,
  validateIdParam,
  [body("status").notEmpty()],
  validate,
  updateTournamentStatus
);

// FIX M1: DELETE /api/tournaments/:id removed — use DELETE /api/archive/tournaments/:id instead

export default router;
