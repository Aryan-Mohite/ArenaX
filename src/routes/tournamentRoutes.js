import { Router } from "express";
import {
  getTournaments,
  getTournamentById,
  createTournament,
  registerForTournament,
  updateTournamentStatus,
  // FIX M1: deleteTournament removed — archive-aware version lives in archiveRoutes.js
  updateBranding,
  getTournamentAnalytics,
  announceToTournament,
  getMyTournaments,
  getMyTournamentsSummary,
  getCollegeStandings,
} from "../controllers/tournamentController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCreateTournament, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body } from "express-validator";
import { requireFeature } from "../services/featureService.js";

const router = Router();

// GET /api/tournaments?game_id=&region=&status=&limit=&offset=
router.get("/", getTournaments);

// ─── §2 organizer dashboard — must be registered before GET /:id, or
// "mine" would be captured as an :id and fail int validation. ────────────
// GET /api/tournaments/mine
router.get("/mine", authMiddleware, getMyTournaments);

// GET /api/tournaments/mine/summary  (Organization tier)
router.get(
  "/mine/summary",
  authMiddleware,
  requireFeature("multi_tournament_dashboard"),
  getMyTournamentsSummary
);

// GET /api/tournaments/:id/college-standings  (§3, public)
router.get("/:id/college-standings", validateIdParam, validate, getCollegeStandings);

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

// ─── §2 organizer tiers ─────────────────────────────────────────────────

// PATCH /api/tournaments/:id/branding  (Pro/Org tier)
router.patch(
  "/:id/branding",
  authMiddleware,
  validateIdParam,
  validate,
  requireFeature("branded_page"),
  updateBranding
);

// GET /api/tournaments/:id/analytics  (Pro/Org tier)
router.get(
  "/:id/analytics",
  authMiddleware,
  validateIdParam,
  validate,
  requireFeature("analytics"),
  getTournamentAnalytics
);

// POST /api/tournaments/:id/announce  (Pro/Org tier)
router.post(
  "/:id/announce",
  authMiddleware,
  validateIdParam,
  [body("message").notEmpty().isLength({ max: 500 })],
  validate,
  requireFeature("announcements"),
  announceToTournament
);

// FIX M1: DELETE /api/tournaments/:id removed — use DELETE /api/archive/tournaments/:id instead

export default router;
