import { Router } from "express";
import {
  getPosts, createPost, closePost, applyToPost,
  getApplicationsForPost, getMyApplications,
  draftAcceptApplication, finalAcceptApplication, rejectApplication,
  adminDeletePost,
} from "../controllers/teamFinderController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateTeamFinderPost, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";

const router = Router();

// Static routes MUST come before dynamic /:id routes
router.get("/",                   getPosts);
router.post("/",                  authMiddleware, validateTeamFinderPost, validate, createPost);
router.get("/my-applications",    authMiddleware, getMyApplications);

// Dynamic /:id routes
router.patch("/:id/close",        authMiddleware, validateIdParam, validate, closePost);
router.post("/:id/apply",         authMiddleware, validateIdParam, validate, applyToPost);
router.get("/:id/applications",   authMiddleware, validateIdParam, validate, getApplicationsForPost);
router.patch("/:id/applications/:appId/draft-accept",  authMiddleware, validateIdParam, validate, draftAcceptApplication);
router.patch("/:id/applications/:appId/final-accept",  authMiddleware, validateIdParam, validate, finalAcceptApplication);
router.patch("/:id/applications/:appId/reject",        authMiddleware, validateIdParam, validate, rejectApplication);

// DELETE /api/team-finder/:id — admin only hard delete
router.delete("/:id", authMiddleware, validateIdParam, validate, adminDeletePost);

export default router;
