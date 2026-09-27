import { Router } from "express";
import {
  requestVerification, getMyVerificationStatus,
  acceptOrganizerTerms, getTermsStatus,
} from "../controllers/organizerController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post("/verification-request", authMiddleware, requestVerification);
router.get("/verification-status", authMiddleware, getMyVerificationStatus);

// §9: Organizer Terms / Tournament Agreement
router.post("/accept-terms", authMiddleware, acceptOrganizerTerms);
router.get("/terms-status", authMiddleware, getTermsStatus);

export default router;
