import { Router } from "express";
import { getLiveStreams, goLive, endStream, updateViewerCount } from "../controllers/streamController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { body, param } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/streams?game_id=&limit=&offset=
router.get("/", getLiveStreams);

// POST /api/streams/go-live
router.post(
  "/go-live",
  authMiddleware,
  [
    body("game_id").notEmpty().isInt({ min: 1 }),
    body("title").trim().notEmpty().isLength({ max: 200 }),
    body("stream_url").optional().isURL(),
  ],
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
