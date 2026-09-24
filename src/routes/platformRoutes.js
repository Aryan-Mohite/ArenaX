import { Router } from "express";
import { getPublicStats } from "../controllers/platformController.js";

const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/platform/stats — real DB counts for the homepage stats bar
router.get("/stats", getPublicStats);

export default router;
