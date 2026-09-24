import { Router } from "express";
import { getLiveStreams, goLive, endStream, updateViewerCount } from "../controllers/streamController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateGoLive } from "../utils/validators.js";
import { param, body } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/streams?game_id=&limit=&offset=
router.get("/", getLiveStreams);

// POST /api/streams/go-live
// FIX (high): was using inline validators with no platform enum or URL protocol check.
// Now uses validateGoLive from validators.js which adds proper constraints.
router.post(
  "/go-live",
  authMiddleware,
  validateGoLive,
  validate,
  goLive
);

// PATCH /api/streams/end
router.patch("/end", authMiddleware, endStream);

// PATCH /api/streams/:id/viewers
router.patch(
  "/:id/viewers",
  authMiddleware,
  [
    param("id").isInt({ min: 1 }),
    body("viewer_count").isInt({ min: 0 }),
  ],
  validate,
  updateViewerCount
);

export default router;
