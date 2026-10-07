import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { getPublicTraction } from "../controllers/tractionController.js";

const router = Router();

// Public and unauthenticated, so keep it tight: also makes guessing tokens pointless.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again in a minute." },
});

router.get("/:token", limiter, getPublicTraction);
export default router;
