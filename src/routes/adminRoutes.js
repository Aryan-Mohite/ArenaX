import { Router } from "express";
import {
  getAllUsers,
  banUser,
  unbanUser,
  getPlatformStats,
  forceUpdateUsername,
  getBillingStats,
  getOrganizerVerifications,
  approveOrganizerVerification,
  rejectOrganizerVerification,
  getCollegeClaims,
  approveCollegeClaim,
  rejectCollegeClaim,
  setCollegeLicense,
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

// ─── Billing (§1 payments infra) ───────────────────────────────────────────
// GET /api/admin/billing
router.get("/billing", getBillingStats);

// ─── Organizer verification queue (§2) ─────────────────────────────────────
router.get("/organizer-verifications", getOrganizerVerifications);
router.post("/organizer-verifications/:id/approve", approveOrganizerVerification);
router.post("/organizer-verifications/:id/reject", rejectOrganizerVerification);

// ─── College claim queue + licensing (§3) ──────────────────────────────────
router.get("/colleges", getCollegeClaims);
router.post("/colleges/:id/approve", validateIdParam, validate, approveCollegeClaim);
router.post("/colleges/:id/reject", validateIdParam, validate, rejectCollegeClaim);
router.post("/colleges/:id/license", validateIdParam, validate, setCollegeLicense);

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
