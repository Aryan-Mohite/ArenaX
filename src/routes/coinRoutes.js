import { Router } from "express";
import { getMyCoins, getMyLedger, redeem, getMyRedemptions } from "../controllers/coinController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// All coin routes require authentication
router.use(authMiddleware);

// GET  /api/coins/me           balance + earn table + catalog
router.get("/me", getMyCoins);
// GET  /api/coins/ledger       my coin history
router.get("/ledger", getMyLedger);
// POST /api/coins/redeem       { reward_id }
router.post("/redeem", redeem);
// GET  /api/coins/redemptions  my redemption history (incl. gift card codes once fulfilled)
router.get("/redemptions", getMyRedemptions);

export default router;
