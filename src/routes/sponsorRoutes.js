import { Router } from "express";
import { applyForSponsor, getMySponsorProfile } from "../controllers/sponsorController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { body } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

router.post(
  "/apply",
  authMiddleware,
  [
    body("company_name").trim().notEmpty().withMessage("Company name is required").isLength({ max: 150 }),
    body("website").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }),
    body("contact_email").optional({ nullable: true, checkFalsy: true }).isEmail(),
    body("logo_url").optional({ nullable: true, checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }),
  ],
  validate,
  applyForSponsor
);

router.get("/me", authMiddleware, getMySponsorProfile);

export default router;
