import { Router } from "express";
import {
  getPosts,
  createPost,
  closePost,
  applyToPost,
  getApplicationsForPost,
} from "../controllers/teamFinderController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateTeamFinderPost, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/teamfinder?game_id=&region=&rank_required=
router.get("/", getPosts);

// POST /api/teamfinder  — create a post (auth required)
router.post("/", authMiddleware, validateTeamFinderPost, validate, createPost);

// PATCH /api/teamfinder/:id/close  — close own post
router.patch("/:id/close", authMiddleware, validateIdParam, validate, closePost);

// POST /api/teamfinder/:id/apply  — apply to a post
router.post("/:id/apply", authMiddleware, validateIdParam, validate, applyToPost);

// GET /api/teamfinder/:id/applications  — get applicants for own post
router.get("/:id/applications", authMiddleware, validateIdParam, validate, getApplicationsForPost);

export default router;
