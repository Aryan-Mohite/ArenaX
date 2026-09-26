import { Router } from "express";
import { getMyReferralCode, getMyReferrals } from "../controllers/referralController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/referrals/mine/code — lightweight "share your code" widget
router.get("/mine/code", authMiddleware, getMyReferralCode);

// GET /api/referrals/mine — full ambassador dashboard
router.get("/mine", authMiddleware, getMyReferrals);

export default router;
