import { Router } from "express";
import { reportUser, reportTournament } from "../controllers/reportController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { body, param } from "express-validator";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

const reasonValidator = [
  body("reason").trim().notEmpty().withMessage("A reason is required").isLength({ max: 1000 }),
  body("category").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 30 }),
];

router.post(
  "/user/:userId",
  authMiddleware,
  [param("userId").isInt({ min: 1 }), ...reasonValidator],
  validate,
  reportUser
);

router.post(
  "/tournament/:tournamentId",
  authMiddleware,
  [param("tournamentId").isInt({ min: 1 }), ...reasonValidator],
  validate,
  reportTournament
);

export default router;
