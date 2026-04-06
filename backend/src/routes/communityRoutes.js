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
} from "../controllers/communityController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateCommunityPost, validateIdParam } from "../utils/validators.js";
import validate from "../middleware/validateMiddleware.js";
import { body, param } from "express-validator";

const router = Router();

// GET /api/communities?game_id=
router.get("/", getCommunities);

// GET /api/communities/all-posts?game_ids=1,2,3&following=true
router.get("/all-posts", (req, res, next) => {
  req.optionalAuth = true;
  next();
}, getAllFavGamesPosts);

// GET /api/communities/:id/posts
router.get("/:id/posts", validateIdParam, validate, getCommunityPosts);

// GET /api/communities/:id/following-posts
router.get("/:id/following-posts", authMiddleware, validateIdParam, validate, getFollowingPosts);

// POST /api/communities/:id/posts
router.post("/:id/posts", authMiddleware, validateIdParam, validateCommunityPost, validate, createPost);

// GET /api/communities/posts/:post_id
router.get("/posts/:post_id", [param("post_id").isInt({ min: 1 })], validate, getPost);

// POST /api/communities/posts/:post_id/comments
router.post(
  "/posts/:post_id/comments",
  authMiddleware,
  [param("post_id").isInt({ min: 1 }), body("content").trim().notEmpty()],
  validate,
  addComment
);

// POST /api/communities/posts/:post_id/vote
router.post(
  "/posts/:post_id/vote",
  authMiddleware,
  [param("post_id").isInt({ min: 1 }), body("vote").isIn(["up", "down"])],
  validate,
  votePost
);

export default router;
