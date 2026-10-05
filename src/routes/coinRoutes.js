import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { getMyCoins, getMyLedger, redeem, getMyRedemptions, getMyBalance, disputeRedemption } from "../controllers/coinController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// Per-user limiters (keyed on the authenticated user id, so many accounts behind
// one IP/NAT are not penalised and one account cannot hammer the endpoint).
// Redeeming moves real value, so it gets a much tighter ceiling than the
// global 120 req/min /api limiter. Tune the numbers here.
const perUser = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `u${req.user?.id ?? "anon"}`,
    validate: { keyGeneratorIpFallback: false },
    message: { success: false, message },
  });

const redeemLimiter = perUser(10 * 60 * 1000, 5, "Too many redemption attempts. Please wait a few minutes and try again.");
const disputeLimiter = perUser(60 * 60 * 1000, 5, "Too many reports submitted. Please try again later.");

// All coin routes require authentication
router.use(authMiddleware);

// GET  /api/coins/me           balance + earn table + catalog
router.get("/me", getMyCoins);
// GET  /api/coins/ledger       my coin history
router.get("/ledger", getMyLedger);
// POST /api/coins/redeem       { reward_id }
router.post("/redeem", redeemLimiter, redeem);
// GET  /api/coins/redemptions  my redemption history (incl. gift card codes once fulfilled)
router.get("/redemptions", getMyRedemptions);
// GET  /api/coins/balance      light balance for the navbar
router.get("/balance", getMyBalance);
// POST /api/coins/redemptions/:id/dispute  { reason } -- report a missing / invalid reward
router.post("/redemptions/:id/dispute", disputeLimiter, disputeRedemption);

export default router;
