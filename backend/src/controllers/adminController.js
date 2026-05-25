import pool from "../config/db.js";

// Note: isAdmin check is now handled by requireAdmin middleware in adminRoutes.js
// — no need to repeat it in each handler.

// ─── GET ALL USERS (admin only) ───────────────────────────────────────────────
// GET /api/admin/users?status=active|banned&limit=50&offset=0&q=username
export const getAllUsers = async (req, res, next) => {
  try {
    const { status, q, limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT user_id, username, email, status, created_at, last_login,
             country, profile_picture
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ success: true, users: result.rows, count: result.rows.length });
  } catch (err) { next(err); }
};

// ─── BAN USER (admin only) ────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/ban
// Body: { reason: "optional reason string" }
export const banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = "Banned by admin" } = req.body;

    // Prevent banning another admin (safety check)
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const target = await pool.query(
      "SELECT user_id, username, email, status FROM users WHERE user_id = $1",
      [id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (adminEmails.includes(target.rows[0].email.toLowerCase())) {
      return res.status(403).json({ success: false, message: "Cannot ban another admin" });
    }
    if (target.rows[0].status === "banned") {
      return res.status(400).json({ success: false, message: "User is already banned" });
    }

    await pool.query(
      "UPDATE users SET status = 'banned' WHERE user_id = $1",
      [id]
    );

    res.json({
      success: true,
      message: `User @${target.rows[0].username} has been banned`,
      reason,
    });
  } catch (err) { next(err); }
};

// ─── UNBAN USER (admin only) ──────────────────────────────────────────────────
// PATCH /api/admin/users/:id/unban
export const unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const target = await pool.query(
      "SELECT user_id, username, status FROM users WHERE user_id = $1",
      [id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (target.rows[0].status !== "banned") {
      return res.status(400).json({ success: false, message: "User is not currently banned" });
    }

    await pool.query(
      "UPDATE users SET status = 'active' WHERE user_id = $1",
      [id]
    );

    res.json({
      success: true,
      message: `User @${target.rows[0].username} has been unbanned`,
    });
  } catch (err) { next(err); }
};

// ─── PLATFORM STATS (admin only) ──────────────────────────────────────────────
// GET /api/admin/stats
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newUsersToday,
      totalTournaments,
      activeTournaments,
      totalTeams,
      totalPosts,
      postsToday,
      liveStreams,
      totalTeamFinderPosts,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM users WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) FROM users WHERE status = 'banned'"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) FROM tournaments"),
      pool.query("SELECT COUNT(*) FROM tournaments WHERE status IN ('upcoming', 'ongoing')"),
      pool.query("SELECT COUNT(*) FROM teams"),
      pool.query("SELECT COUNT(*) FROM community_posts"),
      pool.query("SELECT COUNT(*) FROM community_posts WHERE created_at >= NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) FROM streams WHERE status = 'live'"),
      pool.query("SELECT COUNT(*) FROM team_finder_posts WHERE status = 'open'"),
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total:   parseInt(totalUsers.rows[0].count),
          active:  parseInt(activeUsers.rows[0].count),
          banned:  parseInt(bannedUsers.rows[0].count),
          newToday: parseInt(newUsersToday.rows[0].count),
        },
        tournaments: {
          total:  parseInt(totalTournaments.rows[0].count),
          active: parseInt(activeTournaments.rows[0].count),
        },
        teams:        parseInt(totalTeams.rows[0].count),
        posts: {
          total:   parseInt(totalPosts.rows[0].count),
          today:   parseInt(postsToday.rows[0].count),
        },
        liveStreams:       parseInt(liveStreams.rows[0].count),
        openTeamFinderPosts: parseInt(totalTeamFinderPosts.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ─── FORCE UPDATE USERNAME (admin only) ───────────────────────────────────────
// PATCH /api/admin/users/:id/username
// Body: { username: "newUsername" }
export const forceUpdateUsername = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username || username.trim().length < 3 || username.trim().length > 30) {
      return res.status(400).json({ success: false, message: "Username must be 3–30 characters" });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: "Username can only contain letters, numbers, and underscores" });
    }

    // Check it's not already taken
    const taken = await pool.query(
      "SELECT user_id FROM users WHERE username = $1 AND user_id != $2",
      [username.trim(), id]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken" });
    }

    const result = await pool.query(
      "UPDATE users SET username = $1 WHERE user_id = $2 RETURNING user_id, username",
      [username.trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: `Username updated to @${result.rows[0].username}`,
      user: result.rows[0],
    });
  } catch (err) { next(err); }
};
