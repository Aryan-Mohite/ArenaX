import { Router } from "express";
import {
  createTeam, getTeam, getMyTeams, getAllTeams, deleteTeam,
  kickMember, inviteMember, respondToInvitation, leaveTeam
} from "../controllers/teamController.js";
import { getTeamMessages, sendTeamMessage } from "../controllers/teamChatController.js";
import authMiddleware  from "../middleware/authMiddleware.js";
import requireAdmin    from "../middleware/requireAdmin.js";
import { validateCreateTeam, validateIdParam, validateSendTeamMessage } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// Static routes first
router.get("/mine",               authMiddleware, getMyTeams);
// FIX C4: getAllTeams is admin-only — any auth user could call it before
router.get("/all",                authMiddleware, requireAdmin, getAllTeams);
router.post("/",                  authMiddleware, validateCreateTeam, validate, createTeam);
router.patch("/invitations/:invite_id", authMiddleware, [param("invite_id").isInt({min:1}), body("action").isIn(["accept","decline"])], validate, respondToInvitation);

// Dynamic /:id routes
router.get("/:id",                validateIdParam, validate, getTeam);
// FIX M1: DELETE /:id removed here — archive-aware delete lives in archiveRoutes.js at /api/archive/teams/:id
router.delete("/:id/leave",       authMiddleware, validateIdParam, validate, leaveTeam);
router.delete("/:id/members/:userId", authMiddleware, validateIdParam, validate, kickMember);
router.post("/:id/invite",        authMiddleware, validateIdParam, [body("user_id").notEmpty().isInt({min:1})], validate, inviteMember);

// Team group chat — membership is checked inside the controllers (active team_members only)
router.get("/:id/messages",       authMiddleware, validateIdParam, validate, getTeamMessages);
router.post("/:id/messages",      authMiddleware, validateIdParam, validateSendTeamMessage, validate, sendTeamMessage);

export default router;
