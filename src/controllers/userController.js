import pool from "../config/db.js";
import { sanitizeFields } from "../utils/sanitize.js";
import { hasFeature } from "../services/featureService.js";
import { syncOneTimeCoinsSafe } from "../services/coinService.js";

// ─── GET PUBLIC PROFILE ───────────────────────────────────────────────────────
export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [userRows] = await pool.query(
      `SELECT user_id, username, profile_picture, profile_banner_url, country, region, bio, created_at,
              karma_positive, karma_negative
       FROM users WHERE user_id = ? AND status = 'active'`,
      [id]
    );
    if (userRows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    // §4: verified badge — a single-profile lookup, so the plain hasFeature()
    // helper is fine here (no N+1 concern the way a listing query would have).
    const isVerified = await hasFeature(Number(id), "verified_badge");

    const [gameProfiles] = await pool.query(
      `SELECT ugp.rank, ugp.role, ugp.win_rate, ugp.matches_played, ugp.elo_rating,
              g.game_name, g.icon
       FROM user_game_profile ugp
       JOIN games g ON g.game_id = ugp.game_id
       WHERE ugp.user_id = ?`,
      [id]
    );

    const [achievements] = await pool.query(
      `SELECT a.name, a.description, a.icon, ua.earned_at
       FROM user_achievements ua
       JOIN achievements a ON a.achievement_id = ua.achievement_id
       WHERE ua.user_id = ?
       ORDER BY ua.earned_at DESC LIMIT 5`,
      [id]
    );

    const [gameIdRows] = await pool.query(
      `SELECT platform, game_id_value FROM user_game_ids WHERE user_id = ?`,
      [id]
    );
    const game_ids = {};
    gameIdRows.forEach(r => { game_ids[r.platform] = r.game_id_value; });

    res.json({
      success: true,
      profile: { ...userRows[0], is_verified: isVerified, game_profiles: gameProfiles, achievements, game_ids },
    });
  } catch (err) { next(err); }
};

// ─── UPDATE OWN PROFILE ───────────────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // FIX H9: sanitize user-supplied text fields before storing
    const sanitized = sanitizeFields({ ...req.body }, ["username", "bio", "country", "region"]);
    const { username, bio, country, region, profile_picture, profile_banner_url } = sanitized;

    // §4: profile_banner_url is an ArenaX Pro perk — silently dropped (not
    // an error) if the user isn't entitled, same "enforce, don't just
    // reject" pattern §2 already uses for the free-tier max_teams cap. A
    // lapsed subscriber keeps whatever banner they already set; they just
    // can't change it further until they resubscribe.
    let effectiveBannerUrl = null;
    if (profile_banner_url) {
      const canSetBanner = await hasFeature(userId, "profile_banner");
      if (canSetBanner) effectiveBannerUrl = profile_banner_url;
    }

    // FIX M2: base64 size check (kept from previous fix — char count is acceptable
    // for base64 because each char ~= 1 byte of encoded data)
    if (profile_picture?.startsWith("data:") && profile_picture.length > 5_000_000) {
      return res.status(413).json({
        success: false,
        message: "Profile picture is too large. Maximum base64 size is ~3.75 MB.",
      });
    }

    // profile_picture URL length already capped at 500 chars by validateUpdateProfile validator

    if (username) {
      const [conflict] = await pool.query(
        "SELECT user_id FROM users WHERE username = ? AND user_id != ?",
        [username, userId]
      );
      if (conflict.length > 0)
        return res.status(409).json({ success: false, message: "Username is already taken" });
    }

    await pool.query(
      `UPDATE users
       SET username        = COALESCE(?, username),
           bio             = COALESCE(?, bio),
           country         = COALESCE(?, country),
           region          = COALESCE(?, region),
           profile_picture = COALESCE(?, profile_picture),
           profile_banner_url = COALESCE(?, profile_banner_url)
       WHERE user_id = ?`,
      [username || null, bio || null, country || null, region || null, profile_picture || null, effectiveBannerUrl, userId]
    );

    const [updated] = await pool.query(
      "SELECT user_id, username, email, bio, country, region, profile_picture, profile_banner_url FROM users WHERE user_id = ?",
      [userId]
    );

    res.json({ success: true, user: updated[0] });
    syncOneTimeCoinsSafe(userId); // §11: profile-completion coins
  } catch (err) { next(err); }
};

// ─── UPSERT GAME PROFILE ──────────────────────────────────────────────────────
export const upsertGameProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { game_id, rank, role, elo_rating } = req.body;

    await pool.query(
      `INSERT INTO user_game_profile (user_id, game_id, \`rank\`, \`role\`, elo_rating)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`rank\`     = VALUES(\`rank\`),
         \`role\`     = VALUES(\`role\`),
         elo_rating = VALUES(elo_rating)`,
      [userId, game_id, rank, role, elo_rating || 1000]
    );

    const [profile] = await pool.query(
      "SELECT * FROM user_game_profile WHERE user_id = ? AND game_id = ?",
      [userId, game_id]
    );

    res.json({ success: true, game_profile: profile[0] });
    syncOneTimeCoinsSafe(userId); // §11: first-game coins
  } catch (err) { next(err); }
};

// ─── SEARCH USERS ─────────────────────────────────────────────────────────────
export const searchUsers = async (req, res, next) => {
  try {
    const { q = "", limit: _rawLimit = 20, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit), 100);

    const [rows] = await pool.query(
      `SELECT user_id, username, profile_picture, country, region
       FROM users
       WHERE status = 'active' AND username LIKE ?
       ORDER BY username
       LIMIT ? OFFSET ?`,
      [`%${q}%`, limit, Number(offset)]
    );

    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
};

// ─── FOLLOW USER ──────────────────────────────────────────────────────────────
export const followUser = async (req, res, next) => {
  try {
    const followerId  = req.user.id;
    const { id: followingId } = req.params;

    if (String(followerId) === String(followingId))
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });

    const [target] = await pool.query(
      "SELECT user_id FROM users WHERE user_id = ? AND status = 'active'",
      [followingId]
    );
    if (target.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    await pool.query(
      "INSERT IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?)",
      [followerId, followingId]
    );

    res.json({ success: true, following: true });
  } catch (err) { next(err); }
};

// ─── UNFOLLOW USER ────────────────────────────────────────────────────────────
export const unfollowUser = async (req, res, next) => {
  try {
    const followerId  = req.user.id;
    const { id: followingId } = req.params;

    await pool.query(
      "DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?",
      [followerId, followingId]
    );

    res.json({ success: true, following: false });
  } catch (err) { next(err); }
};

// ─── GET MY FOLLOW STATS ──────────────────────────────────────────────────────
export const getMyFollowStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [[followers], [following], [posts]] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM user_follows WHERE following_id = ?", [userId]),
      pool.query("SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = ?",  [userId]),
      pool.query("SELECT COUNT(*) AS count FROM community_posts WHERE user_id = ?",   [userId]),
    ]);

    res.json({
      success: true,
      stats: {
        followers:       Number(followers[0].count),
        following:       Number(following[0].count),
        community_posts: Number(posts[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ─── CHECK FOLLOW STATUS ──────────────────────────────────────────────────────
export const getFollowStatus = async (req, res, next) => {
  try {
    const followerId  = req.user.id;
    const { id: followingId } = req.params;

    const [[statusRows], [statsRows]] = await Promise.all([
      pool.query(
        "SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?",
        [followerId, followingId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM user_follows    WHERE following_id = ?) AS followers,
           (SELECT COUNT(*) FROM user_follows    WHERE follower_id  = ?) AS following_count,
           (SELECT COUNT(*) FROM community_posts WHERE user_id      = ?) AS community_posts`,
        [followingId, followingId, followingId]
      ),
    ]);

    res.json({
      success:         true,
      following:       statusRows.length > 0,
      followers:       Number(statsRows[0].followers),
      following_count: Number(statsRows[0].following_count),
      community_posts: Number(statsRows[0].community_posts),
    });
  } catch (err) { next(err); }
};

// ─── GET FOLLOWERS LIST ───────────────────────────────────────────────────────
export const getFollowers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit) || 50, 100);

    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.profile_picture, u.country, u.region, uf.created_at AS followed_at
       FROM user_follows uf
       JOIN users u ON u.user_id = uf.follower_id
       WHERE uf.following_id = ? AND u.status = 'active'
       ORDER BY uf.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, Number(offset)]
    );

    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
};

// ─── GET FOLLOWING LIST ───────────────────────────────────────────────────────
export const getFollowing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit: _rawLimit = 50, offset = 0 } = req.query;
    const limit = Math.min(Number(_rawLimit) || 50, 100);

    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.profile_picture, u.country, u.region, uf.created_at AS followed_at
       FROM user_follows uf
       JOIN users u ON u.user_id = uf.following_id
       WHERE uf.follower_id = ? AND u.status = 'active'
       ORDER BY uf.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, Number(offset)]
    );

    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
};

// ─── GET USER ACTIVITY ────────────────────────────────────────────────────────
export const getUserActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [
      [communityPosts],
      [teamFinderPosts],
      [gameProfiles],
      [teams],
    ] = await Promise.all([
      pool.query(
        `SELECT cp.post_id, cp.title, cp.content, cp.image_url,
                cp.upvotes, cp.downvotes, cp.comment_count, cp.created_at,
                c.name AS community_name, g.game_name
         FROM community_posts cp
         JOIN communities c ON c.community_id = cp.community_id
         LEFT JOIN games g ON g.game_id = c.game_id
         WHERE cp.user_id = ?
         ORDER BY cp.created_at DESC LIMIT 20`,
        [id]
      ),
      pool.query(
        `SELECT tfp.post_id, tfp.rank_required, tfp.role_required, tfp.region,
                tfp.description, tfp.status, tfp.deadline, tfp.created_at,
                g.game_name
         FROM team_finder_posts tfp
         LEFT JOIN games g ON g.game_id = tfp.game_id
         WHERE tfp.user_id = ?
         ORDER BY tfp.created_at DESC LIMIT 20`,
        [id]
      ),
      pool.query(
        `SELECT ugp.rank, ugp.role, ugp.win_rate, ugp.matches_played, ugp.elo_rating,
                g.game_name, g.icon
         FROM user_game_profile ugp
         JOIN games g ON g.game_id = ugp.game_id
         WHERE ugp.user_id = ?`,
        [id]
      ),
      pool.query(
        `SELECT t.team_id, t.team_name, t.region, t.description, t.created_at,
                g.game_name, g.icon AS game_icon,
                tm.role AS member_role,
                SUM(CASE WHEN tm2.status = 'active' THEN 1 ELSE 0 END) AS member_count
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         LEFT JOIN games g ON g.game_id = t.game_id
         LEFT JOIN team_members tm2 ON tm2.team_id = t.team_id
         WHERE tm.user_id = ? AND tm.status = 'active'
         GROUP BY t.team_id, g.game_name, g.icon, tm.role
         ORDER BY tm.joined_at DESC`,
        [id]
      ),
    ]);

    res.json({
      success: true,
      community_posts:   communityPosts,
      team_finder_posts: teamFinderPosts,
      game_profiles:     gameProfiles,
      teams,
    });
  } catch (err) { next(err); }
};
// ─── GET OWN GAME IDs ─────────────────────────────────────────────────────────
export const getMyGameIds = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT platform, game_id_value FROM user_game_ids WHERE user_id = ?`,
      [req.user.id]
    );
    // Convert to key-value object for easy frontend consumption
    const ids = {};
    rows.forEach(r => { ids[r.platform] = r.game_id_value; });
    res.json({ success: true, game_ids: ids });
  } catch (err) { next(err); }
};

// ─── UPDATE GAME IDs (upsert) ─────────────────────────────────────────────────
// Body: { steam: "id", riot: "tag#NA1", epic: "username", ... }
// Send empty string "" to clear a platform ID
export const updateGameIds = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ALLOWED_PLATFORMS = [
      "steam", "riot", "epic", "battlenet", "psn",
      "xbox", "ubisoft", "ea", "faceit", "bgmi"
    ];

    const updates = [];
    const deletes = [];

    for (const platform of ALLOWED_PLATFORMS) {
      if (!(platform in req.body)) continue;
      const val = String(req.body[platform] || "").trim().slice(0, 120);
      if (val === "") {
        deletes.push(platform);
      } else {
        updates.push([userId, platform, val]);
      }
    }

    // Upsert non-empty values
    if (updates.length > 0) {
      await pool.query(
        `INSERT INTO user_game_ids (user_id, platform, game_id_value)
         VALUES ?
         ON DUPLICATE KEY UPDATE game_id_value = VALUES(game_id_value)`,
        [updates]
      );
    }

    // Delete cleared values
    if (deletes.length > 0) {
      await pool.query(
        `DELETE FROM user_game_ids WHERE user_id = ? AND platform IN (?)`,
        [userId, deletes]
      );
    }

    // Return fresh data
    const [rows] = await pool.query(
      `SELECT platform, game_id_value FROM user_game_ids WHERE user_id = ?`,
      [userId]
    );
    const ids = {};
    rows.forEach(r => { ids[r.platform] = r.game_id_value; });

    res.json({ success: true, game_ids: ids });
  } catch (err) { next(err); }
};
// ─── ADVANCED STATS (§4, ArenaX Pro) ─────────────────────────────────────────
// GET /api/users/:id/advanced-stats — gated on the *viewer's* plan
// (requireFeature("advanced_stats") in userRoutes.js), not the profile
// owner's — this is a perk for the Pro subscriber doing the looking
// (e.g. scouting a potential teammate), same framing as priority Team
// Finder placement being about how a Pro subscriber's own posts are
// treated. Browsing a profile itself stays free regardless — this only
// adds a deeper view on top.
export const getAdvancedStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[target]] = await pool.query("SELECT user_id FROM users WHERE user_id = ? AND status = 'active'", [id]);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [
      eloStandings,
      [recentMatches],
      [[winLoss]],
    ] = await Promise.all([
      // Elo percentile per game this user has a profile in — computed
      // against everyone else with a profile for that same game.
      pool.query(
        `SELECT ugp.game_id, g.game_name, ugp.elo_rating, ugp.rank, ugp.matches_played, ugp.win_rate,
                (SELECT COUNT(*) FROM user_game_profile o WHERE o.game_id = ugp.game_id AND o.elo_rating <= ugp.elo_rating)
                  / (SELECT COUNT(*) FROM user_game_profile o WHERE o.game_id = ugp.game_id) AS percentile
           FROM user_game_profile ugp
           JOIN games g ON g.game_id = ugp.game_id
          WHERE ugp.user_id = ?`,
        [id]
      ).then(([rows]) => rows.map(row => ({ ...row, percentile: Number((row.percentile || 0).toFixed(3)) }))),
      // Last 10 completed matches across every team this user is/was on.
      pool.query(
        `SELECT m.match_id, m.match_date, m.score, m.round, t.name AS tournament_name,
                CASE WHEN m.team1_id = tm.team_id THEN t2.team_name ELSE t1.team_name END AS opponent_team_name,
                (m.winner_team_id = tm.team_id) AS won
           FROM team_members tm
           JOIN matches m ON (m.team1_id = tm.team_id OR m.team2_id = tm.team_id) AND m.status = 'completed'
           JOIN tournaments t ON t.tournament_id = m.tournament_id
           LEFT JOIN teams t1 ON t1.team_id = m.team1_id
           LEFT JOIN teams t2 ON t2.team_id = m.team2_id
          WHERE tm.user_id = ?
          ORDER BY m.match_date DESC
          LIMIT 10`,
        [id]
      ),
      pool.query(
        `SELECT
            COUNT(*) AS played,
            SUM(m.winner_team_id = tm.team_id) AS wins
           FROM team_members tm
           JOIN matches m ON (m.team1_id = tm.team_id OR m.team2_id = tm.team_id) AND m.status = 'completed'
          WHERE tm.user_id = ?`,
        [id]
      ),
    ]);

    const played = Number(winLoss.played) || 0;
    const wins = Number(winLoss.wins) || 0;

    res.json({
      success: true,
      stats: {
        eloStandings,
        recentMatches: recentMatches.map(m => ({ ...m, won: !!m.won })),
        winLoss: { played, wins, losses: played - wins },
      },
    });
  } catch (err) { next(err); }
};
