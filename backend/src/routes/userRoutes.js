import { Router } from "express";
import {
  getUserProfile,
  updateProfile,
  upsertGameProfile,
  searchUsers,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/users?q=username  — search users
router.get("/", authMiddleware, searchUsers);

// GET /api/users/:id  — public profile
router.get("/:id", validateIdParam, validate, getUserProfile);

// PUT /api/users/me  — update own profile
router.put("/me", authMiddleware, updateProfile);

// POST /api/users/me/game-profile  — add or update game rank/ELO
router.post("/me/game-profile", authMiddleware, upsertGameProfile);

export default router;
