import { Router } from "express";
import { body } from "express-validator";
import {
  saveMyDna, getMyDna, getCandidates, swipe, getMyMatches,
  rateTeammate, getMatchRating,
} from "../controllers/gamerDnaController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// All Gamer DNA routes require authentication
router.use(authMiddleware);

const validateDna = [
  body("play_style").isIn(["casual", "balanced", "competitive"]),
  body("comms_pref").isIn(["voice", "text", "silent"]),
  body("session_goal").isIn(["unwind", "improve", "win", "socialize"]),
];

const validateSwipe = [
  body("target_id").isInt({ min: 1 }).withMessage("target_id must be a positive integer"),
  body("action").isIn(["like", "pass"]),
];

router.get("/me",          getMyDna);
router.post("/",           validateDna,   validate, saveMyDna);
router.get("/candidates",  getCandidates);
router.post("/swipe",      validateSwipe, validate, swipe);
router.get("/matches",     getMyMatches);

const validateRating = [
  body("score").isIn(["positive", "negative"]),
  body("tag").optional({ nullable: true }).isIn(["good_comms", "team_player", "reliable", "carried_us"]),
];
router.post("/matches/:matchId/rate",   validateRating, validate, rateTeammate);
router.get("/matches/:matchId/rating",  getMatchRating);

export default router;
