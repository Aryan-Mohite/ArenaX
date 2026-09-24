import { Router } from "express";
import { requestVerification, getMyVerificationStatus } from "../controllers/organizerController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post("/verification-request", authMiddleware, requestVerification);
router.get("/verification-status", authMiddleware, getMyVerificationStatus);

export default router;
