import pool from "../config/db.js";

// ─── GET COMMUNITIES ──────────────────────────────────────────────────────────
export const getCommunities = async (req, res, next) => {
  try {
    const { game_id } = req.query;
    let query = `
      SELECT c.*, g.game_name, g.icon,
             COUNT(cp.post_id) AS post_count
      FROM communities c
      JOIN games g ON g.game_id = c.game_id
      LEFT JOIN community_posts cp ON cp.community_id = c.community_id
      WHERE 1=1
    `;
    const params = [];
    if (game_id) { params.push(game_id); query += ` AND c.game_id = $${params.length}`; }
    query += " GROUP BY c.community_id, g.game_name, g.icon ORDER BY post_count DESC";
    const result = await pool.query(query, params);
    res.json({ success: true, communities: result.rows });
  } catch (err) { next(err); }
};

// ─── GET POSTS IN COMMUNITY ───────────────────────────────────────────────────
export const getCommunityPosts = async (req, res, next) => {
  try {
    const { id: community_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const result = await pool.query(
      `SELECT cp.*, u.username, u.profile_picture,
              COUNT(pc.comment_id) AS comment_count
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       LEFT JOIN post_comments pc ON pc.post_id = cp.post_id
       WHERE cp.community_id = $1
       GROUP BY cp.post_id, u.username, u.profile_picture
       ORDER BY cp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [community_id, Number(limit), Number(offset)]
    );
    res.json({ success: true, posts: result.rows });
  } catch (err) { next(err); }
};

// ─── CREATE POST (now accepts image_url) ─────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { id: community_id } = req.params;
    const { title, content, image_url } = req.body;
    const userId = req.user.id;

    const community = await pool.query(
      "SELECT community_id FROM communities WHERE community_id = $1",
      [community_id]
    );
    if (community.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Community not found" });
    }

    const result = await pool.query(
      `INSERT INTO community_posts (community_id, user_id, title, content, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [community_id, userId, title, content, image_url || null]
    );

    res.status(201).json({ success: true, post: result.rows[0] });
  } catch (err) { next(err); }
};

// ─── GET SINGLE POST WITH COMMENTS ───────────────────────────────────────────
export const getPost = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const postResult = await pool.query(
      `SELECT cp.*, u.username, u.profile_picture
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       WHERE cp.post_id = $1`,
      [post_id]
    );
    if (postResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const commentsResult = await pool.query(
      `SELECT pc.*, u.username, u.profile_picture
       FROM post_comments pc
       JOIN users u ON u.user_id = pc.user_id
       WHERE pc.post_id = $1
       ORDER BY pc.created_at ASC`,
      [post_id]
    );
    res.json({
      success: true,
      post: { ...postResult.rows[0], comments: commentsResult.rows },
    });
  } catch (err) { next(err); }
};

// ─── ADD COMMENT ──────────────────────────────────────────────────────────────
export const addComment = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    const post = await pool.query(
      "SELECT post_id FROM community_posts WHERE post_id = $1", [post_id]
    );
    if (post.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const result = await pool.query(
      `INSERT INTO post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [post_id, userId, content]
    );
    // Return comment with username so frontend can display it immediately
    const full = await pool.query(
      `SELECT pc.*, u.username, u.profile_picture
       FROM post_comments pc JOIN users u ON u.user_id = pc.user_id
       WHERE pc.comment_id = $1`,
      [result.rows[0].comment_id]
    );
    res.status(201).json({ success: true, comment: full.rows[0] });
  } catch (err) { next(err); }
};

// ─── UPVOTE / DOWNVOTE POST ───────────────────────────────────────────────────
// ─── UPVOTE / DOWNVOTE POST (one vote per user, toggle/switch support) ────────
export const votePost = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const { vote } = req.body;
    const userId = req.user.id;

    if (!["up", "down"].includes(vote)) {
      return res.status(400).json({ success: false, message: "vote must be 'up' or 'down'" });
    }

    const existing = await pool.query(
      "SELECT vote_id, vote_type FROM post_votes WHERE post_id = $1 AND user_id = $2",
      [post_id, userId]
    );

    let upDelta = 0, downDelta = 0;
    let userVote = vote;

    if (existing.rows.length > 0) {
      const prev = existing.rows[0].vote_type;
      if (prev === vote) {
        // Same vote → toggle off
        await pool.query("DELETE FROM post_votes WHERE vote_id = $1", [existing.rows[0].vote_id]);
        if (vote === "up") upDelta = -1; else downDelta = -1;
        userVote = null;
      } else {
        // Switch vote direction
        await pool.query("UPDATE post_votes SET vote_type = $1 WHERE vote_id = $2", [vote, existing.rows[0].vote_id]);
        if (vote === "up") { upDelta = 1; downDelta = -1; } else { upDelta = -1; downDelta = 1; }
      }
    } else {
      await pool.query(
        "INSERT INTO post_votes (post_id, user_id, vote_type) VALUES ($1, $2, $3)",
        [post_id, userId, vote]
      );
      if (vote === "up") upDelta = 1; else downDelta = 1;
    }

    const result = await pool.query(
      `UPDATE community_posts
       SET upvotes = GREATEST(0, upvotes + $2), downvotes = GREATEST(0, downvotes + $3)
       WHERE post_id = $1 RETURNING post_id, upvotes, downvotes`,
      [post_id, upDelta, downDelta]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    res.json({ success: true, votes: result.rows[0], userVote });
  } catch (err) { next(err); }
};

// ─── DELETE POST ──────────────────────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin === true;

    // Admins can delete any post; regular users can only delete their own
    const result = isAdmin
      ? await pool.query(
          "DELETE FROM community_posts WHERE post_id = $1 RETURNING post_id, user_id",
          [post_id]
        )
      : await pool.query(
          "DELETE FROM community_posts WHERE post_id = $1 AND user_id = $2 RETURNING post_id, user_id",
          [post_id, userId]
        );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isAdmin ? "Post not found" : "Post not found or not yours",
      });
    }
    res.json({ success: true, message: isAdmin ? "Post removed by admin" : "Post deleted" });
  } catch (err) { next(err); }
};

// ─── DELETE COMMENT ───────────────────────────────────────────────────────────
export const deleteComment = async (req, res, next) => {
  try {
    const { comment_id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin === true;

    // Admins can delete any comment; regular users can only delete their own
    const result = isAdmin
      ? await pool.query(
          "DELETE FROM post_comments WHERE comment_id = $1 RETURNING comment_id",
          [comment_id]
        )
      : await pool.query(
          "DELETE FROM post_comments WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id",
          [comment_id, userId]
        );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: isAdmin ? "Comment not found" : "Comment not found or not yours",
      });
    }
    res.json({ success: true, message: isAdmin ? "Comment removed by admin" : "Comment deleted" });
  } catch (err) { next(err); }
};

// ─── GET POSTS FROM FOLLOWED USERS (for a community) ─────────────────────────
export const getFollowingPosts = async (req, res, next) => {
  try {
    const { id: community_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT cp.*, u.username, u.profile_picture,
              COUNT(pc.comment_id) AS comment_count
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       LEFT JOIN post_comments pc ON pc.post_id = cp.post_id
       WHERE cp.community_id = $1
         AND cp.user_id IN (
           SELECT following_id FROM user_follows WHERE follower_id = $2
         )
       GROUP BY cp.post_id, u.username, u.profile_picture
       ORDER BY cp.created_at DESC
       LIMIT $3 OFFSET $4`,
      [community_id, userId, Number(limit), Number(offset)]
    );
    res.json({ success: true, posts: result.rows });
  } catch (err) { next(err); }
};

// ─── GET ALL COMMUNITY POSTS ACROSS FAV GAMES ─────────────────────────────────
export const getAllFavGamesPosts = async (req, res, next) => {
  try {
    const { game_ids, limit = 30, offset = 0, following } = req.query;
    const userId = req.user?.id;

    if (!game_ids) return res.json({ success: true, posts: [] });

    const ids = game_ids.split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return res.json({ success: true, posts: [] });

    let query = `
      SELECT cp.*, u.username, u.profile_picture,
             c.name AS community_name, g.game_name,
             COUNT(pc.comment_id) AS comment_count
      FROM community_posts cp
      JOIN users u ON u.user_id = cp.user_id
      JOIN communities c ON c.community_id = cp.community_id
      JOIN games g ON g.game_id = c.game_id
      LEFT JOIN post_comments pc ON pc.post_id = cp.post_id
      WHERE c.game_id = ANY($1::int[])
    `;

    const params = [ids];

    if (following === 'true' && userId) {
      params.push(userId);
      query += ` AND cp.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $${params.length})`;
    }

    query += ` GROUP BY cp.post_id, u.username, u.profile_picture, c.name, g.game_name
               ORDER BY cp.created_at DESC
               LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    res.json({ success: true, posts: result.rows });
  } catch (err) { next(err); }
};

// ─── GET ALL POSTS (admin only) ───────────────────────────────────────────────
export const getAllPosts = async (req, res, next) => {
  try {
    const { limit = 25, offset = 0 } = req.query;
    const result = await pool.query(
      `SELECT cp.post_id, cp.title, cp.content, cp.created_at,
              cp.upvotes, cp.downvotes, cp.comment_count,
              u.username, u.user_id,
              c.name AS community_name
       FROM community_posts cp
       JOIN users u ON u.user_id = cp.user_id
       JOIN communities c ON c.community_id = cp.community_id
       ORDER BY cp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ success: true, posts: result.rows });
  } catch (err) { next(err); }
};