import { Router } from "express";
import {
  getUserProfile,
  updateProfile,
  upsertGameProfile,
  searchUsers,
  followUser,
  unfollowUser,
  getMyFollowStats,
  getFollowStatus,
  getUserActivity,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/users?q=username  — search users
router.get("/", authMiddleware, searchUsers);

// GET /api/users/me/stats — followers/following/post counts for self
router.get("/me/stats", authMiddleware, getMyFollowStats);

// GET /api/users/:id  — public profile
router.get("/:id", validateIdParam, validate, getUserProfile);

// GET /api/users/:id/activity — community posts + team finder posts
router.get("/:id/activity", validateIdParam, validate, getUserActivity);

// GET /api/users/:id/follow-status — is current user following :id?
router.get("/:id/follow-status", authMiddleware, validateIdParam, validate, getFollowStatus);

// PUT /api/users/me  — update own profile
router.put("/me", authMiddleware, updateProfile);

// POST /api/users/me/game-profile  — add or update game rank/ELO
router.post("/me/game-profile", authMiddleware, upsertGameProfile);

// POST /api/users/:id/follow
router.post("/:id/follow", authMiddleware, validateIdParam, validate, followUser);

// DELETE /api/users/:id/follow
router.delete("/:id/follow", authMiddleware, validateIdParam, validate, unfollowUser);

export default router;