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
  getReports,
  resolveReport,
  getDisputes,
  resolveDispute,
  getAnalyticsOverview,
  getRetentionCohorts,
  getFunnel,
  getOrganizerRetention,
  getAnalyticsTrend,
  getSponsorApplications,
  approveSponsorApplication,
  rejectSponsorApplication,
  getPlacements,
  createPlacement,
  updatePlacement,
  getSponsorInsights,
} from "../controllers/adminController.js";
import { body } from "express-validator";
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

// ─── Reports queue + payment disputes (§9) ─────────────────────────────────
router.get("/reports", getReports);
router.post("/reports/:id/resolve", validateIdParam, validate, resolveReport);
router.get("/disputes", getDisputes);
router.post("/disputes/:id/resolve", validateIdParam, validate, resolveDispute);

// ─── Analytics & events layer (§6) ──────────────────────────────────────────
router.get("/analytics/overview", getAnalyticsOverview);
router.get("/analytics/retention", getRetentionCohorts);
router.get("/analytics/funnel", getFunnel);
router.get("/analytics/organizer-retention", getOrganizerRetention);
router.get("/analytics/trend", getAnalyticsTrend);

// ─── Sponsorship (§5) ────────────────────────────────────────────────────────
router.get("/sponsors", getSponsorApplications);
router.post("/sponsors/:id/approve", validateIdParam, validate, approveSponsorApplication);
router.post("/sponsors/:id/reject", validateIdParam, validate, rejectSponsorApplication);

router.get("/placements", getPlacements);
router.post(
  "/placements",
  [
    body("tournament_id").isInt({ min: 1 }),
    body("sponsor_id").isInt({ min: 1 }),
    body("slot_type").optional({ nullable: true, checkFalsy: true }).isIn(["featured_tournament", "banner"]),
    body("starts_at").optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body("ends_at").optional({ nullable: true, checkFalsy: true }).isISO8601(),
  ],
  validate,
  createPlacement
);
router.patch(
  "/placements/:id",
  [...validateIdParam, body("is_active").isBoolean()],
  validate,
  updatePlacement
);

router.get("/sponsor-insights", getSponsorInsights);

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
