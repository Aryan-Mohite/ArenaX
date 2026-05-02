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

    // Guard: reject base64 strings over ~7MB (5MB raw → ~6.7MB base64 + overhead)
    // Anything larger means the 10mb body limit was somehow bypassed or misused
    if (profile_picture && profile_picture.startsWith("data:") && profile_picture.length > 7_000_000) {
      return res.status(413).json({
        success: false,
        message: "Profile picture is too large. Maximum upload size is 5 MB.",
      });
    }

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

// ─── FOLLOW USER ──────────────────────────────────────────────────────────────
export const followUser = async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const { id: followingId } = req.params;

    if (String(followerId) === String(followingId)) {
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });
    }

    // Verify the target user actually exists and is active
    const targetCheck = await pool.query(
      "SELECT user_id FROM users WHERE user_id = $1 AND status = 'active'",
      [followingId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Upsert to avoid duplicate errors
    await pool.query(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    res.json({ success: true, following: true });
  } catch (err) { next(err); }
};

// ─── UNFOLLOW USER ────────────────────────────────────────────────────────────
export const unfollowUser = async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const { id: followingId } = req.params;

    await pool.query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    res.json({ success: true, following: false });
  } catch (err) { next(err); }
};

// ─── GET FOLLOW STATS + community post count for current user ─────────────────
export const getMyFollowStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [followers, following, posts] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM user_follows WHERE following_id = $1`, [userId]),
      pool.query(`SELECT COUNT(*) FROM user_follows WHERE follower_id = $1`, [userId]),
      pool.query(`SELECT COUNT(*) FROM community_posts WHERE user_id = $1`, [userId]),
    ]);

    res.json({
      success: true,
      stats: {
        followers: Number(followers.rows[0].count),
        following: Number(following.rows[0].count),
        community_posts: Number(posts.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ─── CHECK IF CURRENT USER FOLLOWS target ─────────────────────────────────────
export const getFollowStatus = async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const { id: followingId } = req.params;

    const result = await pool.query(
      `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    const targetStats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM user_follows WHERE following_id = $1) AS followers,
         (SELECT COUNT(*) FROM user_follows WHERE follower_id = $1) AS following,
         (SELECT COUNT(*) FROM community_posts WHERE user_id = $1) AS community_posts`,
      [followingId]
    );

    res.json({
      success: true,
      following: result.rows.length > 0,
      ...targetStats.rows[0],
    });
  } catch (err) { next(err); }
};

// ─── GET USER ACTIVITY (community posts + team finder posts) ──────────────────
export const getUserActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [communityPosts, teamFinderPosts, gameProfiles, teams] = await Promise.all([
      pool.query(
        `SELECT cp.post_id, cp.title, cp.content, cp.image_url, cp.upvotes, cp.downvotes,
                cp.comment_count, cp.created_at,
                c.name AS community_name, g.game_name
         FROM community_posts cp
         JOIN communities c ON c.community_id = cp.community_id
         LEFT JOIN games g ON g.game_id = c.game_id
         WHERE cp.user_id = $1
         ORDER BY cp.created_at DESC
         LIMIT 20`,
        [id]
      ),
      pool.query(
        `SELECT tfp.post_id, tfp.rank_required, tfp.role_required, tfp.region,
                tfp.description, tfp.status, tfp.deadline, tfp.created_at,
                g.game_name
         FROM team_finder_posts tfp
         LEFT JOIN games g ON g.game_id = tfp.game_id
         WHERE tfp.user_id = $1
         ORDER BY tfp.created_at DESC
         LIMIT 20`,
        [id]
      ),
      pool.query(
        `SELECT ugp.rank, ugp.role, ugp.win_rate, ugp.matches_played, ugp.elo_rating,
                g.game_name, g.icon
         FROM user_game_profile ugp
         JOIN games g ON g.game_id = ugp.game_id
         WHERE ugp.user_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT t.team_id, t.team_name, t.region, t.description, t.created_at,
                g.game_name, g.icon AS game_icon,
                tm.role AS member_role,
                COUNT(tm2.user_id) FILTER (WHERE tm2.status = 'active') AS member_count
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         LEFT JOIN games g ON g.game_id = t.game_id
         LEFT JOIN team_members tm2 ON tm2.team_id = t.team_id
         WHERE tm.user_id = $1 AND tm.status = 'active'
         GROUP BY t.team_id, g.game_name, g.icon, tm.role
         ORDER BY tm.joined_at DESC`,
        [id]
      ),
    ]);

    res.json({
      success: true,
      community_posts: communityPosts.rows,
      team_finder_posts: teamFinderPosts.rows,
      game_profiles: gameProfiles.rows,
      teams: teams.rows,
    });
  } catch (err) {
    next(err);
  }
};