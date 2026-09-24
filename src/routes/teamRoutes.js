import { Router } from "express";
import {
  createTeam, getTeam, getMyTeams, getAllTeams, deleteTeam,
  kickMember, inviteMember, respondToInvitation, leaveTeam
} from "../controllers/teamController.js";
import authMiddleware  from "../middleware/authMiddleware.js";
import requireAdmin    from "../middleware/requireAdmin.js";
import { validateCreateTeam, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// Static routes first
router.get("/mine",               authMiddleware, getMyTeams);
router.get("/all",                authMiddleware, requireAdmin, getAllTeams);
router.post("/",                  authMiddleware, validateCreateTeam, validate, createTeam);
router.patch("/invitations/:invite_id", authMiddleware, [param("invite_id").isInt({min:1}), body("action").isIn(["accept","decline"])], validate, respondToInvitation);

// Dynamic /:id routes
router.get("/:id",                validateIdParam, validate, getTeam);
router.delete("/:id/leave",       authMiddleware, validateIdParam, validate, leaveTeam);
router.delete("/:id/members/:userId", authMiddleware, validateIdParam, validate, kickMember);
router.post("/:id/invite",        authMiddleware, validateIdParam, [body("user_id").notEmpty().isInt({min:1})], validate, inviteMember);

export default router;
