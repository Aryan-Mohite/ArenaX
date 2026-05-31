import pool from "../config/db.js";
import { sanitizeFields } from "../utils/sanitize.js";

// ─── GET ALL COMMUNITIES ──────────────────────────────────────────────────────
export const getCommunities = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.community_id, c.name, c.description, c.banner_url,
              g.game_name, g.icon AS game_icon,
              COUNT(DISTINCT cp.post_id) AS post_count
       FROM communities c
       LEFT JOIN games g ON g.game_id = c.game_id
       LEFT JOIN community_posts cp ON cp.community_id = c.community_id
       GROUP BY c.community_id, g.game_name, g.icon
       ORDER BY post_count DESC`
    );
    res.json({ success: true, communities: rows });
  } catch (err) { next(err); }
};

// ─── GET POSTS FOR A COMMUNITY ────────────────────────────────────────────────
export const getCommunityPosts = async (req, res, next) => {
  try {
    const { id: community_id } = req.params;
    const { limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    const [rows] = await pool.query(
      `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
              cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
              u.username, u.profile_picture,
              g.game_name
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       LEFT JOIN communities c ON c.community_id = cp.community_id
       LEFT JOIN games g ON g.game_id = c.game_id
       WHERE cp.community_id = ?
       ORDER BY cp.created_at DESC
       LIMIT ? OFFSET ?`,
      [community_id, limit, Number(offset)]
    );

    res.json({ success: true, posts: rows });
  } catch (err) { next(err); }
};

// ─── CREATE POST ──────────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { id: community_id } = req.params;
    const userId = req.user.id;

    // FIX H9: sanitize user-generated content before storing
    const body = sanitizeFields({ ...req.body }, ["title", "content"]);
    const { title, content, image_url } = body;

    const [communityRows] = await pool.query(
      "SELECT community_id FROM communities WHERE community_id = ?",
      [community_id]
    );
    if (communityRows.length === 0)
      return res.status(404).json({ success: false, message: "Community not found" });

    const [result] = await pool.query(
      `INSERT INTO community_posts (community_id, user_id, title, content, image_url)
       VALUES (?, ?, ?, ?, ?)`,
      [community_id, userId, title, content, image_url || null]
    );

    const [newPost] = await pool.query(
      `SELECT cp.*, u.username, u.profile_picture
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       WHERE cp.post_id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, post: newPost[0] });
  } catch (err) { next(err); }
};

// ─── GET SINGLE POST ──────────────────────────────────────────────────────────
export const getPost = async (req, res, next) => {
  try {
    const { post_id } = req.params;

    const [postRows] = await pool.query(
      `SELECT cp.*, u.username, u.profile_picture, g.game_name
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       LEFT JOIN communities c ON c.community_id = cp.community_id
       LEFT JOIN games g ON g.game_id = c.game_id
       WHERE cp.post_id = ?`,
      [post_id]
    );
    if (postRows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });

    const [comments] = await pool.query(
      `SELECT pc.comment_id, pc.content, pc.created_at,
              u.user_id, u.username, u.profile_picture
       FROM post_comments pc
       JOIN users u ON u.user_id = pc.user_id
       WHERE pc.post_id = ?
       ORDER BY pc.created_at ASC`,
      [post_id]
    );

    res.json({ success: true, post: { ...postRows[0], comments } });
  } catch (err) { next(err); }
};

// ─── ADD COMMENT ─────────────────────────────────────────────────────────────
export const addComment = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const userId = req.user.id;

    // FIX H9: sanitize comment content
    const { content: rawContent } = req.body;
    const { content } = sanitizeFields({ content: rawContent }, ["content"]);

    const [postRows] = await pool.query(
      "SELECT post_id FROM community_posts WHERE post_id = ?",
      [post_id]
    );
    if (postRows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });

    const [result] = await pool.query(
      "INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)",
      [post_id, userId, content]
    );

    await pool.query(
      "UPDATE community_posts SET comment_count = comment_count + 1 WHERE post_id = ?",
      [post_id]
    );

    const [newComment] = await pool.query(
      `SELECT pc.*, u.username, u.profile_picture
       FROM post_comments pc
       JOIN users u ON u.user_id = pc.user_id
       WHERE pc.comment_id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, comment: newComment[0] });
  } catch (err) { next(err); }
};

// ─── VOTE ON POST ─────────────────────────────────────────────────────────────
export const votePost = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const userId = req.user.id;
    const { vote } = req.body; // "up" | "down"

    const voteType = vote === "up" ? "upvote" : "downvote";
    const voteCol  = vote === "up" ? "upvotes" : "downvotes";

    const [existing] = await pool.query(
      "SELECT vote_id, vote_type FROM post_votes WHERE post_id = ? AND user_id = ?",
      [post_id, userId]
    );

    if (existing.length > 0) {
      if (existing[0].vote_type === voteType) {
        // Toggle off — remove vote
        await pool.query("DELETE FROM post_votes WHERE vote_id = ?", [existing[0].vote_id]);
        await pool.query(
          `UPDATE community_posts SET ${voteCol} = GREATEST(0, ${voteCol} - 1) WHERE post_id = ?`,
          [post_id]
        );
        return res.json({ success: true, voted: false });
      } else {
        // Switch vote
        const oldCol = vote === "up" ? "downvotes" : "upvotes";
        await pool.query("UPDATE post_votes SET vote_type = ? WHERE vote_id = ?", [voteType, existing[0].vote_id]);
        await pool.query(
          `UPDATE community_posts
           SET ${voteCol} = ${voteCol} + 1,
               ${oldCol}  = GREATEST(0, ${oldCol} - 1)
           WHERE post_id = ?`,
          [post_id]
        );
        return res.json({ success: true, voted: true, vote });
      }
    }

    await pool.query(
      "INSERT INTO post_votes (post_id, user_id, vote_type) VALUES (?, ?, ?)",
      [post_id, userId, voteType]
    );
    await pool.query(
      `UPDATE community_posts SET ${voteCol} = ${voteCol} + 1 WHERE post_id = ?`,
      [post_id]
    );

    res.json({ success: true, voted: true, vote });
  } catch (err) { next(err); }
};

// ─── FOLLOWING FEED ───────────────────────────────────────────────────────────
export const getFollowingPosts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    const [rows] = await pool.query(
      `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
              cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
              u.user_id, u.username, u.profile_picture,
              c.name AS community_name,
              g.game_name
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       JOIN user_follows uf ON uf.following_id = cp.user_id
       LEFT JOIN communities c ON c.community_id = cp.community_id
       LEFT JOIN games g ON g.game_id = c.game_id
       WHERE uf.follower_id = ?
       ORDER BY cp.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, Number(offset)]
    );

    res.json({ success: true, posts: rows });
  } catch (err) { next(err); }
};

// ─── ALL FAV GAMES POSTS (optional auth) ──────────────────────────────────────
export const getAllFavGamesPosts = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { limit: _rawLimit = 20, offset = 0, following } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    // If following=true but user is not authenticated, fall back to all posts
    if (following === "true" && userId) {
      const [rows] = await pool.query(
        `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
                cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
                u.user_id, u.username, u.profile_picture,
                c.name AS community_name, g.game_name
         FROM community_posts cp
         JOIN users u ON u.user_id = cp.user_id
         JOIN user_follows uf ON uf.following_id = cp.user_id
         LEFT JOIN communities c ON c.community_id = cp.community_id
         LEFT JOIN games g ON g.game_id = c.game_id
         WHERE uf.follower_id = ?
         ORDER BY cp.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, Number(offset)]
      );
      return res.json({ success: true, posts: rows });
    }

    // Default: posts from communities matching user's fav games (or all if no auth)
    let rows;
    if (userId) {
      [rows] = await pool.query(
        `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
                cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
                u.user_id, u.username, u.profile_picture,
                c.name AS community_name, g.game_name
         FROM community_posts cp
         JOIN users u ON u.user_id = cp.user_id
         LEFT JOIN communities c ON c.community_id = cp.community_id
         LEFT JOIN games g ON g.game_id = c.game_id
         WHERE c.game_id IN (
           SELECT game_id FROM user_game_profile WHERE user_id = ?
         )
         ORDER BY cp.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, Number(offset)]
      );
    } else {
      [rows] = await pool.query(
        `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
                cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
                u.user_id, u.username, u.profile_picture,
                c.name AS community_name, g.game_name
         FROM community_posts cp
         JOIN users u ON u.user_id = cp.user_id
         LEFT JOIN communities c ON c.community_id = cp.community_id
         LEFT JOIN games g ON g.game_id = c.game_id
         ORDER BY cp.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, Number(offset)]
      );
    }

    res.json({ success: true, posts: rows });
  } catch (err) { next(err); }
};

// ─── DELETE POST ──────────────────────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT user_id FROM community_posts WHERE post_id = ?",
      [post_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });

    const isOwner = String(rows[0].user_id) === String(userId);
    const isAdmin = req.user?.isAdmin;

    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised to delete this post" });

    await pool.query("DELETE FROM community_posts WHERE post_id = ?", [post_id]);
    res.json({ success: true, message: "Post deleted" });
  } catch (err) { next(err); }
};

// ─── DELETE COMMENT ───────────────────────────────────────────────────────────
export const deleteComment = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT user_id, post_id FROM post_comments WHERE comment_id = ?",
      [comment_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Comment not found" });

    if (String(rows[0].user_id) !== String(userId) && !req.user?.isAdmin)
      return res.status(403).json({ success: false, message: "Not authorised to delete this comment" });

    await pool.query("DELETE FROM post_comments WHERE comment_id = ?", [comment_id]);
    await pool.query(
      "UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE post_id = ?",
      [rows[0].post_id]
    );

    res.json({ success: true, message: "Comment deleted" });
  } catch (err) { next(err); }
};

// ─── GET ALL POSTS (admin only) ───────────────────────────────────────────────
export const getAllPosts = async (req, res, next) => {
  try {
    const { limit: _rawLimit = 50, offset = 0, search = "" } = req.query;
    const limit = Math.min(Number(_rawLimit), 200);

    const [rows] = await pool.query(
      `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
              cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
              u.user_id, u.username,
              c.name AS community_name
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       LEFT JOIN communities c ON c.community_id = cp.community_id
       WHERE cp.title LIKE ? OR u.username LIKE ?
       ORDER BY cp.created_at DESC
       LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, limit, Number(offset)]
    );

    res.json({ success: true, posts: rows });
  } catch (err) { next(err); }
};
