import pool from "../config/db.js";

// ─── GET PUBLIC PROFILE ───────────────────────────────────────────────────────
export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      `SELECT user_id, username, profile_picture, country, region, bio, created_at
       FROM users
       WHERE user_id = $1 AND status = 'active'`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch per-game profiles for this user
    const gameProfilesResult = await pool.query(
      `SELECT ugp.rank, ugp.role, ugp.win_rate, ugp.matches_played, ugp.elo_rating,
              g.game_name, g.icon
       FROM user_game_profile ugp
       JOIN games g ON g.game_id = ugp.game_id
       WHERE ugp.user_id = $1`,
      [id]
    );

    // Fetch recent achievements
    const achievementsResult = await pool.query(
      `SELECT a.name, a.description, a.icon, ua.earned_at
       FROM user_achievements ua
       JOIN achievements a ON a.achievement_id = ua.achievement_id
       WHERE ua.user_id = $1
       ORDER BY ua.earned_at DESC
       LIMIT 5`,
      [id]
    );

    res.json({
      success: true,
      profile: {
        ...userResult.rows[0],
        game_profiles: gameProfilesResult.rows,
        achievements: achievementsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE OWN PROFILE ───────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username, bio, country, region, profile_picture } = req.body;

    // If changing username, make sure it's not taken
    if (username) {
      const conflict = await pool.query(
        "SELECT user_id FROM users WHERE username = $1 AND user_id != $2",
        [username, userId]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Username is already taken" });
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET username        = COALESCE($1, username),
           bio             = COALESCE($2, bio),
           country         = COALESCE($3, country),
           region          = COALESCE($4, region),
           profile_picture = COALESCE($5, profile_picture)
       WHERE user_id = $6
       RETURNING user_id, username, email, bio, country, region, profile_picture`,
      [username, bio, country, region, profile_picture, userId]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── UPSERT GAME PROFILE ──────────────────────────────────────────────────────
export const upsertGameProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id, rank, role, elo_rating } = req.body;

    const result = await pool.query(
      `INSERT INTO user_game_profile (user_id, game_id, rank, role, elo_rating)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, game_id) DO UPDATE
         SET rank       = EXCLUDED.rank,
             role       = EXCLUDED.role,
             elo_rating = EXCLUDED.elo_rating
       RETURNING *`,
      [userId, game_id, rank, role, elo_rating || 1000]
    );

    res.json({ success: true, game_profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── GET ALL USERS (admin / search) ───────────────────────────────────────────
export const searchUsers = async (req, res, next) => {
  try {
    const { q = "", limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT user_id, username, profile_picture, country, region
       FROM users
       WHERE status = 'active'
         AND (username ILIKE $1 OR country ILIKE $1)
       ORDER BY username
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, Number(limit), Number(offset)]
    );

    res.json({ success: true, users: result.rows });
  } catch (err) {
    next(err);
  }
};
