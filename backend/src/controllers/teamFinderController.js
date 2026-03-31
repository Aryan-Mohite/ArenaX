import pool from "../config/db.js";

// ─── GET POSTS (with filters) ─────────────────────────────────────────────────
export const getPosts = async (req, res, next) => {
  try {
    const { game_id, region, rank_required, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT tfp.*, u.username, u.profile_picture, g.game_name, g.icon AS game_icon,
             ugp.rank AS poster_rank, ugp.elo_rating AS poster_elo
      FROM team_finder_posts tfp
      JOIN users u ON u.user_id = tfp.user_id
      JOIN games g ON g.game_id = tfp.game_id
      LEFT JOIN user_game_profile ugp ON ugp.user_id = tfp.user_id AND ugp.game_id = tfp.game_id
      WHERE tfp.status = 'open'
    `;
    const params = [];

    if (game_id) {
      params.push(game_id);
      query += ` AND tfp.game_id = $${params.length}`;
    }
    if (region) {
      params.push(region);
      query += ` AND tfp.region ILIKE $${params.length}`;
    }
    if (rank_required) {
      params.push(rank_required);
      query += ` AND tfp.rank_required ILIKE $${params.length}`;
    }

    params.push(Number(limit), Number(offset));
    query += ` ORDER BY tfp.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ success: true, posts: result.rows });
  } catch (err) {
    next(err);
  }
};

// ─── CREATE POST ──────────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { game_id, rank_required, role_required, region, description } = req.body;
    const userId = req.user.id;

    // A user can only have one open post per game
    const existing = await pool.query(
      "SELECT post_id FROM team_finder_posts WHERE user_id = $1 AND game_id = $2 AND status = 'open'",
      [userId, game_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You already have an open post for this game",
      });
    }

    const result = await pool.query(
      `INSERT INTO team_finder_posts
         (user_id, game_id, rank_required, role_required, region, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,'open')
       RETURNING *`,
      [userId, game_id, rank_required, role_required, region, description]
    );

    res.status(201).json({ success: true, post: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── CLOSE / DELETE POST ──────────────────────────────────────────────────────
export const closePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE team_finder_posts
       SET status = 'closed'
       WHERE post_id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found or not yours" });
    }

    res.json({ success: true, post: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── APPLY TO A POST ──────────────────────────────────────────────────────────
export const applyToPost = async (req, res, next) => {
  try {
    const { id: post_id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    const post = await pool.query(
      "SELECT * FROM team_finder_posts WHERE post_id = $1 AND status = 'open'",
      [post_id]
    );
    if (post.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found or already closed" });
    }
    if (post.rows[0].user_id === userId) {
      return res.status(400).json({ success: false, message: "Cannot apply to your own post" });
    }

    const existing = await pool.query(
      "SELECT * FROM team_finder_applications WHERE post_id = $1 AND user_id = $2",
      [post_id, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Already applied to this post" });
    }

    const result = await pool.query(
      `INSERT INTO team_finder_applications (post_id, user_id, message)
       VALUES ($1,$2,$3) RETURNING *`,
      [post_id, userId, message]
    );

    res.status(201).json({ success: true, application: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── GET APPLICATIONS FOR MY POST ────────────────────────────────────────────
export const getApplicationsForPost = async (req, res, next) => {
  try {
    const { id: post_id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const post = await pool.query(
      "SELECT user_id FROM team_finder_posts WHERE post_id = $1",
      [post_id]
    );
    if (post.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (post.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: "Not your post" });
    }

    const result = await pool.query(
      `SELECT tfa.*, u.username, u.profile_picture, ugp.rank, ugp.elo_rating
       FROM team_finder_applications tfa
       JOIN users u ON u.user_id = tfa.user_id
       LEFT JOIN user_game_profile ugp ON ugp.user_id = tfa.user_id
       WHERE tfa.post_id = $1
       ORDER BY tfa.applied_at DESC`,
      [post_id]
    );

    res.json({ success: true, applications: result.rows });
  } catch (err) {
    next(err);
  }
};
