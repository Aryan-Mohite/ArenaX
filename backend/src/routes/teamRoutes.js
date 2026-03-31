import { Router } from "express";
import {
  createTeam,
  getTeam,
  inviteMember,
  respondToInvitation,
  leaveTeam,
} from "../controllers/teamController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCreateTeam, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// POST /api/teams
router.post("/", authMiddleware, validateCreateTeam, validate, createTeam);

// GET /api/teams/:id
router.get("/:id", validateIdParam, validate, getTeam);

// POST /api/teams/:id/invite
router.post(
  "/:id/invite",
  authMiddleware,
  validateIdParam,
  [body("user_id").notEmpty().isInt({ min: 1 })],
  validate,
  inviteMember
);

// PATCH /api/teams/invitations/:invite_id  — accept or decline
router.patch(
  "/invitations/:invite_id",
  authMiddleware,
  [
    param("invite_id").isInt({ min: 1 }),
    body("action").isIn(["accept", "decline"]),
  ],
  validate,
  respondToInvitation
);

// DELETE /api/teams/:id/leave
router.delete("/:id/leave", authMiddleware, validateIdParam, validate, leaveTeam);

export default router;
