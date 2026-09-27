import { Router } from "express";
import { listGear, redirectToGear } from "../controllers/gearController.js";
import { param } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// GET /api/gear?category=  — public
router.get("/", listGear);

// GET /api/gear/:id/redirect — public, logs a click then 302s to the
// affiliate link. No auth required (see gearController.js).
router.get(
  "/:id/redirect",
  [param("id").isInt({ min: 1 })],
  validate,
  redirectToGear
);

export default router;
