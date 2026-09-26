import { Router } from "express";
import {
  claimCollege,
  listColleges,
  getCollegeBySlug,
  getCollegeLeaderboard,
  joinCollege,
  leaveCollege,
} from "../controllers/collegeController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateClaimCollege, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// Static routes MUST come before dynamic /:slug or /:id routes
router.get("/",              listColleges);
router.get("/leaderboard",   getCollegeLeaderboard);
router.post("/claim",        authMiddleware, validateClaimCollege, validate, claimCollege);
router.post("/leave",        authMiddleware, leaveCollege);

// GET /api/colleges/:slug — public profile page (slug, not numeric, so this
// is intentionally not behind validateIdParam)
router.get("/:slug", getCollegeBySlug);

// POST /api/colleges/:id/join — numeric id
router.post("/:id/join", authMiddleware, validateIdParam, validate, joinCollege);

export default router;
