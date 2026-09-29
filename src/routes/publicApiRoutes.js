import { Router } from "express";
import { param } from "express-validator";
import apiKeyAuth from "../middleware/apiKeyAuth.js";
import validate from "../middleware/validateMiddleware.js";
import { apiListTournaments, apiTournamentRegistrations } from "../controllers/apiKeyController.js";

// Read-only, API-key-authenticated (Organization tier). GET only by design.
const router = Router();
router.use(apiKeyAuth);

router.get("/tournaments", apiListTournaments);
router.get(
  "/tournaments/:id/registrations",
  [param("id").isInt({ min: 1 })],
  validate,
  apiTournamentRegistrations
);

export default router;
