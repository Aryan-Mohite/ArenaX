import { Router } from "express";
import {
  requestVerification, getMyVerificationStatus,
  acceptOrganizerTerms, getTermsStatus,
} from "../controllers/organizerController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireFeature } from "../services/featureService.js";
import { listApiKeys, createApiKey, revokeApiKey } from "../controllers/apiKeyController.js";

const router = Router();

router.post("/verification-request", authMiddleware, requestVerification);
router.get("/verification-status", authMiddleware, getMyVerificationStatus);

// §9: Organizer Terms / Tournament Agreement
router.post("/accept-terms", authMiddleware, acceptOrganizerTerms);
router.get("/terms-status", authMiddleware, getTermsStatus);

// §2 Organization tier: read-only API keys (used against /api/v1)
router.get("/api-keys", authMiddleware, requireFeature("api_access"), listApiKeys);
router.post("/api-keys", authMiddleware, requireFeature("api_access"), createApiKey);
router.delete("/api-keys/:id", authMiddleware, requireFeature("api_access"), revokeApiKey);

export default router;
