import { Router } from "express";
import {
  getCommunities,
  getCommunityPosts,
  createPost,
  getPost,
  addComment,
  votePost,
  getFollowingPosts,
  getAllFavGamesPosts,
  deletePost,
  deleteComment,
  getAllPosts,
} from "../controllers/communityController.js";
import authMiddleware  from "../middleware/authMiddleware.js";
import requireAdmin    from "../middleware/requireAdmin.js";
import { validateCommunityPost, validateComment, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

// FIX M3: proper optional-auth middleware — parses JWT if present but never rejects
import { verifyToken } from "../utils/jwt.js";
import pool from "../config/db.js";

const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();
  try {
    const decoded = verifyToken(authHeader.split(" ")[1]);
    const [rows] = await pool.query(
      "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
      [decoded.id]
    );
    if (rows.length > 0) req.user = decoded;
  } catch { /* invalid token — treat as unauthenticated */ }
  next();
};

const router = Router();

router.get("/", getCommunities);

// FIX C3: getAllPosts is admin-only — any auth user could call it before
router.get("/posts", authMiddleware, requireAdmin, getAllPosts);

// FIX M3: real optional-auth instead of the fake req.optionalAuth flag
router.get("/all-posts", optionalAuth, getAllFavGamesPosts);

router.get("/:id/posts", validateIdParam, validate, getCommunityPosts);

router.get("/:id/following-posts", authMiddleware, validateIdParam, validate, getFollowingPosts);

router.post("/:id/posts", authMiddleware, validateIdParam, validateCommunityPost, validate, createPost);

router.get("/posts/:post_id", [param("post_id").isInt({ min: 1 })], validate, getPost);

router.delete(
  "/posts/:post_id",
  authMiddleware,
  [param("post_id").isInt({ min: 1 })],
  validate,
  deletePost
);

router.post(
  "/posts/:post_id/comments",
  authMiddleware,
  [param("post_id").isInt({ min: 1 })],
  validateComment,
  validate,
  addComment
);

router.delete(
  "/comments/:comment_id",
  authMiddleware,
  [param("comment_id").isInt({ min: 1 })],
  validate,
  deleteComment
);

router.post(
  "/posts/:post_id/vote",
  authMiddleware,
  [param("post_id").isInt({ min: 1 }), body("vote").isIn(["up", "down"])],
  validate,
  votePost
);

export default router;
