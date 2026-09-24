import { Router } from "express";
import { getMyAchievements, getCheckinStatusHandler, claimCheckin } from "../controllers/achievementController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// All achievement routes require authentication
router.use(authMiddleware);

router.get("/me", getMyAchievements);
router.get("/checkin", getCheckinStatusHandler);
router.post("/checkin", claimCheckin);

export default router;
