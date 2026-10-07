import { listInvestorLinks, createInvestorLink, revokeInvestorLink, previewTraction } from "../controllers/tractionController.js";
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
  getAllGear,
  createGear,
  updateGear,
  deleteGear,
  getGearClicks,
} from "../controllers/adminController.js";
import {
  getCoinSettings, getTournamentPayouts,
  updateCoinSettings,
  getCoinStats,
  getRedemptionQueue,
  approveRedemption,
  fulfilRedemption,
  rejectRedemptionHandler,
  getAdminCatalog,
  createReward,
  updateReward,
  getUserCoinLedger,
  adjustUserCoins,
  getCoinAnalytics,
  exportRedemptions,
  getRedemptionDisputes,
  resolveRedemptionDisputeHandler,
} from "../controllers/adminCoinController.js";
import { getReferralAnalytics } from "../controllers/referralController.js";
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

// ─── Special Coins: economy settings, redemption queue, reward catalog (§11) ─
router.get("/investor-links", listInvestorLinks);
router.post("/investor-links", createInvestorLink);
router.delete("/investor-links/:id", validateIdParam, validate, revokeInvestorLink);
router.get("/traction", previewTraction);
router.get("/coins/settings", getCoinSettings);
router.get("/coins/tournament-payouts", getTournamentPayouts);
router.put("/coins/settings", updateCoinSettings);
router.get("/coins/stats", getCoinStats);
router.get("/coins/redemptions", getRedemptionQueue);
router.post("/coins/redemptions/:id/approve", validateIdParam, validate, approveRedemption);
router.post("/coins/redemptions/:id/fulfil", validateIdParam, validate, fulfilRedemption);
router.post("/coins/redemptions/:id/reject", validateIdParam, validate, rejectRedemptionHandler);
router.get("/coins/catalog", getAdminCatalog);
router.post("/coins/catalog", createReward);
router.patch("/coins/catalog/:id", validateIdParam, validate, updateReward);
router.get("/coins/redemptions/export", exportRedemptions);
router.get("/coins/disputes", getRedemptionDisputes);
router.post("/coins/disputes/:id/resolve", validateIdParam, validate, resolveRedemptionDisputeHandler);
router.get("/coins/users/:id", validateIdParam, validate, getUserCoinLedger);
router.post("/coins/users/:id/adjust", validateIdParam, validate, adjustUserCoins);

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
router.get("/analytics/coins", getCoinAnalytics);
router.get("/analytics/referrals", getReferralAnalytics);

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

// ─── Gear / affiliate commerce (§8) ─────────────────────────────────────────
router.get("/gear", getAllGear);
router.post(
  "/gear",
  [
    body("name").trim().notEmpty().isLength({ max: 150 }),
    body("category").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
    body("image_url").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("price_display").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
    body("affiliate_url").notEmpty().isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("display_order").optional({ nullable: true }).isInt(),
  ],
  validate,
  createGear
);
router.patch(
  "/gear/:id",
  [
    ...validateIdParam,
    body("name").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
    body("category").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
    body("image_url").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("price_display").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
    body("affiliate_url").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("display_order").optional({ nullable: true }).isInt(),
    body("is_active").optional({ nullable: true }).isBoolean(),
  ],
  validate,
  updateGear
);
router.delete("/gear/:id", validateIdParam, validate, deleteGear);
router.get("/gear/:id/clicks", validateIdParam, validate, getGearClicks);

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
