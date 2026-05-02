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
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCommunityPost, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

router.get("/", getCommunities);

// GET /api/community/posts — admin: list all posts across all communities
router.get("/posts", authMiddleware, getAllPosts);

router.get("/all-posts", (req, res, next) => {
  req.optionalAuth = true;
  next();
}, getAllFavGamesPosts);

router.get("/:id/posts", validateIdParam, validate, getCommunityPosts);

router.get("/:id/following-posts", authMiddleware, validateIdParam, validate, getFollowingPosts);

router.post("/:id/posts", authMiddleware, validateIdParam, validateCommunityPost, validate, createPost);

router.get("/posts/:post_id", [param("post_id").isInt({ min: 1 })], validate, getPost);

// DELETE a post (owner only)
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
  [param("post_id").isInt({ min: 1 }), body("content").trim().notEmpty()],
  validate,
  addComment
);

// DELETE a comment (owner only)
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