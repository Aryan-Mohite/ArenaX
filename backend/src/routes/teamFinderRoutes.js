import { Router } from "express";
import {
  getPosts,
  createPost,
  closePost,
  applyToPost,
  getApplicationsForPost,
  getMyApplications,
  acceptApplication,
  rejectApplication,
} from "../controllers/teamFinderController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateTeamFinderPost, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/teamfinder?game_id=&region=&rank_required=
router.get("/", getPosts);

// POST /api/teamfinder  — create a post (auth required)
router.post("/", authMiddleware, validateTeamFinderPost, validate, createPost);

// PATCH /api/teamfinder/:id/close  — close / delete own post
router.patch("/:id/close", authMiddleware, validateIdParam, validate, closePost);

// POST /api/teamfinder/:id/apply  — apply to a post
router.post("/:id/apply", authMiddleware, validateIdParam, validate, applyToPost);

// GET /api/teamfinder/my-applications  — applicant sees their own requests + statuses
router.get("/my-applications", authMiddleware, getMyApplications);

// GET /api/teamfinder/:id/applications  — get applicants for own post
router.get("/:id/applications", authMiddleware, validateIdParam, validate, getApplicationsForPost);

// PATCH /api/teamfinder/:id/applications/:appId/accept  — accept an applicant
router.patch("/:id/applications/:appId/accept", authMiddleware, validateIdParam, validate, acceptApplication);

// PATCH /api/teamfinder/:id/applications/:appId/reject  — reject an applicant
router.patch("/:id/applications/:appId/reject", authMiddleware, validateIdParam, validate, rejectApplication);

export default router;