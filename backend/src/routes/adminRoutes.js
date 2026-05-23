import { Router } from "express";
import {
  getAllUsers,
  banUser,
  unbanUser,
  getPlatformStats,
  forceUpdateUsername,
} from "../controllers/adminController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireAdmin   from "../middleware/requireAdmin.js";
import { validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// All admin routes require a valid JWT AND admin privileges
router.use(authMiddleware, requireAdmin);

// ─── Platform Stats ───────────────────────────────────────────────────────────
// GET /api/admin/stats
router.get("/stats", getPlatformStats);

// ─── User Management ──────────────────────────────────────────────────────────
// GET /api/admin/users?status=banned&q=username&limit=50&offset=0
router.get("/users", getAllUsers);

// PATCH /api/admin/users/:id/ban     body: { reason? }
router.patch("/users/:id/ban",      validateIdParam, validate, banUser);

// PATCH /api/admin/users/:id/unban
router.patch("/users/:id/unban",    validateIdParam, validate, unbanUser);

// PATCH /api/admin/users/:id/username  body: { username }
router.patch("/users/:id/username", validateIdParam, validate, forceUpdateUsername);

export default router;
