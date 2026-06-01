import pool from "../config/db.js";

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res, next) => {
  try {
    const { status, q, limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    let query = `
      SELECT user_id, username, email, status, created_at, last_login,
             country, profile_picture
      FROM users WHERE 1=1
    `;
    const params = [];

    if (status) { params.push(status); query += " AND status = ?"; }
    if (q) {
      params.push(`%${q}%`, `%${q}%`);
      // ILIKE → LIKE (MySQL with utf8mb4_unicode_ci is case-insensitive by default)
      query += " AND (username LIKE ? OR email LIKE ?)";
    }

    params.push(limit, Number(offset));
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";

    const [rows] = await pool.query(query, params);
    res.json({ success: true, users: rows, count: rows.length });
  } catch (err) { next(err); }
};

// ─── BAN USER ─────────────────────────────────────────────────────────────────
export const banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = "Banned by admin" } = req.body;

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

    const [target] = await pool.query(
      "SELECT user_id, username, email, status FROM users WHERE user_id = ?",
      [id]
    );
    if (target.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });
    if (adminEmails.includes(target[0].email.toLowerCase()))
      return res.status(403).json({ success: false, message: "Cannot ban another admin" });
    if (target[0].status === "banned")
      return res.status(400).json({ success: false, message: "User is already banned" });

    await pool.query("UPDATE users SET status = 'banned' WHERE user_id = ?", [id]);

    res.json({ success: true, message: `User @${target[0].username} has been banned`, reason });
  } catch (err) { next(err); }
};

// ─── UNBAN USER ───────────────────────────────────────────────────────────────
export const unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [target] = await pool.query(
      "SELECT user_id, username, status FROM users WHERE user_id = ?",
      [id]
    );
    if (target.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });
    if (target[0].status !== "banned")
      return res.status(400).json({ success: false, message: "User is not currently banned" });

    await pool.query("UPDATE users SET status = 'active' WHERE user_id = ?", [id]);

    res.json({ success: true, message: `User @${target[0].username} has been unbanned` });
  } catch (err) { next(err); }
};

// ─── PLATFORM STATS ───────────────────────────────────────────────────────────
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      [totalUsers],
      [activeUsers],
      [bannedUsers],
      [newUsersToday],
      [totalTournaments],
      [activeTournaments],
      [totalTeams],
      [totalPosts],
      [postsToday],
      [liveStreams],
      [totalTeamFinderPosts],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM users"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE status = 'banned'"),
      // INTERVAL '24 hours' → INTERVAL 24 HOUR
      pool.query("SELECT COUNT(*) AS count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"),
      pool.query("SELECT COUNT(*) AS count FROM tournaments"),
      pool.query("SELECT COUNT(*) AS count FROM tournaments WHERE status IN ('upcoming', 'ongoing')"),
      pool.query("SELECT COUNT(*) AS count FROM teams"),
      pool.query("SELECT COUNT(*) AS count FROM community_posts"),
      pool.query("SELECT COUNT(*) AS count FROM community_posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"),
      pool.query("SELECT COUNT(*) AS count FROM streams WHERE status = 'live'"),
      pool.query("SELECT COUNT(*) AS count FROM team_finder_posts WHERE status = 'open'"),
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total:    parseInt(totalUsers[0].count),
          active:   parseInt(activeUsers[0].count),
          banned:   parseInt(bannedUsers[0].count),
          newToday: parseInt(newUsersToday[0].count),
        },
        tournaments: {
          total:  parseInt(totalTournaments[0].count),
          active: parseInt(activeTournaments[0].count),
        },
        teams:               parseInt(totalTeams[0].count),
        posts: {
          total: parseInt(totalPosts[0].count),
          today: parseInt(postsToday[0].count),
        },
        liveStreams:          parseInt(liveStreams[0].count),
        openTeamFinderPosts:  parseInt(totalTeamFinderPosts[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ─── FORCE UPDATE USERNAME ────────────────────────────────────────────────────
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

    const [taken] = await pool.query(
      "SELECT user_id FROM users WHERE username = ? AND user_id != ?",
      [username.trim(), id]
    );
    if (taken.length > 0)
      return res.status(409).json({ success: false, message: "Username already taken" });

    const [result] = await pool.query(
      "UPDATE users SET username = ? WHERE user_id = ?",
      [username.trim(), id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    // Fetch the updated row (RETURNING not available in MySQL)
    const [updated] = await pool.query(
      "SELECT user_id, username FROM users WHERE user_id = ?",
      [id]
    );

    res.json({
      success: true,
      message: `Username updated to @${updated[0].username}`,
      user: updated[0],
    });
  } catch (err) { next(err); }
};
