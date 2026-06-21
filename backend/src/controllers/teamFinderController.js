import pool from "../config/db.js";

// ─── GET POSTS ────────────────────────────────────────────────────────────────
export const getPosts = async (req, res, next) => {
  try {
    const { game_id, region, team_id, rank_required, limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT tfp.*, u.username, u.profile_picture, u.user_id AS poster_user_id,
             g.game_name, g.icon AS game_icon,
             ugp.rank AS poster_rank, ugp.elo_rating AS poster_elo,
             t.team_name, t.team_id
      FROM team_finder_posts tfp
      JOIN users u ON u.user_id = tfp.user_id
      JOIN games g ON g.game_id = tfp.game_id
      LEFT JOIN user_game_profile ugp ON ugp.user_id = tfp.user_id AND ugp.game_id = tfp.game_id
      LEFT JOIN teams t ON t.team_id = tfp.team_id
      WHERE tfp.status = 'open'
        AND (tfp.deadline IS NULL OR tfp.deadline > NOW())
    `;
    const params = [];

    if (game_id)       { params.push(game_id);          query += " AND tfp.game_id = ?"; }
    // ILIKE → LIKE
    if (region)        { params.push(`%${region}%`);    query += " AND tfp.region LIKE ?"; }
    // Exact match — team_id is a unique identifier, not a fuzzy search field
    if (team_id)        { params.push(team_id);          query += " AND tfp.team_id = ?"; }
    if (rank_required) { params.push(`%${rank_required}%`); query += " AND tfp.rank_required LIKE ?"; }

    params.push(limit, Number(offset));
    query += " ORDER BY tfp.created_at DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, posts: rows });
  } catch (err) { next(err); }
};

// ─── CREATE POST ──────────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { game_id, team_id, rank_required, role_required, region, description, deadline } = req.body;
    const userId = req.user.id;

    if (team_id) {
      const [captainCheck] = await pool.query(
        "SELECT * FROM team_members WHERE team_id=? AND user_id=? AND role='captain' AND status='active'",
        [team_id, userId]
      );
      if (captainCheck.length === 0)
        return res.status(403).json({ success: false, message: "Only the team captain can post a listing for this team" });
    }

    const [existing] = await pool.query(
      "SELECT post_id FROM team_finder_posts WHERE user_id=? AND game_id=? AND status='open'",
      [userId, game_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: "You already have an open draft for this game" });

    const [result] = await pool.query(
      `INSERT INTO team_finder_posts
         (user_id, game_id, team_id, rank_required, role_required, region, description, deadline, status)
       VALUES (?,?,?,?,?,?,?,?,'open')`,
      [userId, game_id, team_id || null, rank_required, role_required, region, description, deadline || null]
    );

    const [post] = await pool.query(
      "SELECT * FROM team_finder_posts WHERE post_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, post: post[0] });
  } catch (err) { next(err); }
};

// ─── CLOSE POST ───────────────────────────────────────────────────────────────
export const closePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [result] = await pool.query(
      "UPDATE team_finder_posts SET status='closed' WHERE post_id=? AND user_id=?",
      [id, userId]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Post not found or not yours" });

    const [post] = await pool.query("SELECT * FROM team_finder_posts WHERE post_id = ?", [id]);
    res.json({ success: true, post: post[0] });
  } catch (err) { next(err); }
};

// ─── APPLY TO A POST ──────────────────────────────────────────────────────────
export const applyToPost = async (req, res, next) => {
  try {
    const { id: post_id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    const [post] = await pool.query(
      "SELECT * FROM team_finder_posts WHERE post_id=? AND status='open' AND (deadline IS NULL OR deadline > NOW())",
      [post_id]
    );
    if (post.length === 0)
      return res.status(404).json({ success: false, message: "Post not found, closed, or expired" });
    if (post[0].user_id === userId)
      return res.status(400).json({ success: false, message: "Cannot apply to your own listing" });

    const [existing] = await pool.query(
      "SELECT * FROM team_finder_applications WHERE post_id=? AND user_id=?",
      [post_id, userId]
    );
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: "Already applied" });

    const [result] = await pool.query(
      "INSERT INTO team_finder_applications (post_id, user_id, message, status) VALUES (?,?,?,'pending')",
      [post_id, userId, message]
    );

    const [application] = await pool.query(
      "SELECT * FROM team_finder_applications WHERE application_id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, application: application[0] });
  } catch (err) { next(err); }
};

// ─── GET APPLICATIONS FOR MY POST ────────────────────────────────────────────
export const getApplicationsForPost = async (req, res, next) => {
  try {
    const { id: post_id } = req.params;
    const userId = req.user.id;

    const [post] = await pool.query("SELECT user_id FROM team_finder_posts WHERE post_id=?", [post_id]);
    if (post.length === 0)
      return res.status(404).json({ success: false, message: "Post not found" });
    if (post[0].user_id !== userId)
      return res.status(403).json({ success: false, message: "Not your post" });

    const [rows] = await pool.query(
      `SELECT tfa.*, u.username, u.profile_picture, u.user_id,
              ugp.rank, ugp.elo_rating, ugp.role AS game_role
       FROM team_finder_applications tfa
       JOIN users u ON u.user_id = tfa.user_id
       LEFT JOIN team_finder_posts tfp ON tfp.post_id = tfa.post_id
       LEFT JOIN user_game_profile ugp ON ugp.user_id = tfa.user_id AND ugp.game_id = tfp.game_id
       WHERE tfa.post_id = ?
       ORDER BY CASE tfa.status WHEN 'draft_accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                tfa.applied_at DESC`,
      [post_id]
    );
    res.json({ success: true, applications: rows });
  } catch (err) { next(err); }
};

// ─── GET MY OWN APPLICATIONS ──────────────────────────────────────────────────
export const getMyApplications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT tfa.application_id, tfa.post_id, tfa.message, tfa.status, tfa.applied_at,
              tfp.role_required, tfp.rank_required, tfp.region,
              g.game_name,
              u.user_id AS poster_user_id, u.username AS poster_username, u.profile_picture AS poster_picture,
              t.team_name, t.team_id
       FROM team_finder_applications tfa
       JOIN team_finder_posts tfp ON tfp.post_id = tfa.post_id
       JOIN games g ON g.game_id = tfp.game_id
       JOIN users u ON u.user_id = tfp.user_id
       LEFT JOIN teams t ON t.team_id = tfp.team_id
       WHERE tfa.user_id = ?
       ORDER BY tfa.applied_at DESC`,
      [userId]
    );
    res.json({ success: true, applications: rows });
  } catch (err) { next(err); }
};

// ─── DRAFT ACCEPT ─────────────────────────────────────────────────────────────
export const draftAcceptApplication = async (req, res, next) => {
  try {
    const { id: post_id, appId: application_id } = req.params;
    const userId = req.user.id;

    const [post] = await pool.query("SELECT user_id FROM team_finder_posts WHERE post_id=?", [post_id]);
    if (post.length === 0) return res.status(404).json({ success: false, message: "Post not found" });
    if (post[0].user_id !== userId) return res.status(403).json({ success: false, message: "Not your post" });

    const [result] = await pool.query(
      "UPDATE team_finder_applications SET status='draft_accepted' WHERE application_id=? AND post_id=?",
      [application_id, post_id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Application not found" });

    const [application] = await pool.query(
      "SELECT * FROM team_finder_applications WHERE application_id = ?",
      [application_id]
    );
    res.json({ success: true, application: application[0] });
  } catch (err) { next(err); }
};

// ─── FINAL ACCEPT ─────────────────────────────────────────────────────────────
export const finalAcceptApplication = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id: post_id, appId: application_id } = req.params;
    const userId = req.user.id;

    const [post] = await pool.query(
      "SELECT tfp.user_id, tfp.team_id FROM team_finder_posts tfp WHERE post_id=?",
      [post_id]
    );
    if (post.length === 0) return res.status(404).json({ success: false, message: "Post not found" });
    if (post[0].user_id !== userId) return res.status(403).json({ success: false, message: "Not your post" });

    const [app] = await pool.query(
      "SELECT * FROM team_finder_applications WHERE application_id=? AND post_id=?",
      [application_id, post_id]
    );
    if (app.length === 0) return res.status(404).json({ success: false, message: "Application not found" });

    await conn.beginTransaction();

    await conn.query(
      "UPDATE team_finder_applications SET status='accepted' WHERE application_id=?",
      [application_id]
    );

    const team_id = post[0].team_id;
    if (team_id) {
      // ON CONFLICT DO UPDATE → ON DUPLICATE KEY UPDATE
      // NOTE: `role` is reserved in MySQL 8.0 — must be backtick-quoted
      await conn.query(
        `INSERT INTO team_members (team_id, user_id, \`role\`, status) VALUES (?,?,'member','active')
         ON DUPLICATE KEY UPDATE status='active', \`role\`='member'`,
        [team_id, app[0].user_id]
      );
    }

    await conn.commit();
    res.json({ success: true, team_id, application: app[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─── REJECT APPLICATION ───────────────────────────────────────────────────────
export const rejectApplication = async (req, res, next) => {
  try {
    const { id: post_id, appId: application_id } = req.params;
    const userId = req.user.id;

    const [post] = await pool.query("SELECT user_id FROM team_finder_posts WHERE post_id=?", [post_id]);
    if (post.length === 0) return res.status(404).json({ success: false, message: "Post not found" });
    if (post[0].user_id !== userId) return res.status(403).json({ success: false, message: "Not your post" });

    const [result] = await pool.query(
      "UPDATE team_finder_applications SET status='rejected' WHERE application_id=? AND post_id=?",
      [application_id, post_id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Application not found" });

    const [application] = await pool.query(
      "SELECT * FROM team_finder_applications WHERE application_id = ?",
      [application_id]
    );
    res.json({ success: true, application: application[0] });
  } catch (err) { next(err); }
};

// ─── ADMIN DELETE ─────────────────────────────────────────────────────────────
export const adminDeletePost = async (req, res, next) => {
  try {
    if (!req.user.isAdmin)
      return res.status(403).json({ success: false, message: "Admin access required" });

    const { id: post_id } = req.params;
    const [result] = await pool.query(
      "DELETE FROM team_finder_posts WHERE post_id = ?",
      [post_id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "Post not found" });

    res.json({ success: true, message: "Team finder post removed by admin" });
  } catch (err) { next(err); }
};
