import pool from "../config/db.js";

// ─── CHECK + AWARD ────────────────────────────────────────────────────────────
// Finds achievements in `category` the user hasn't earned yet whose threshold
// is now met by currentCount, and awards them. Safe to call repeatedly —
// INSERT IGNORE + the unique (user_id, achievement_id) key make this idempotent
// and race-safe if two requests cross a threshold at the same moment.
export const checkAndAwardAchievements = async (userId, category, currentCount) => {
  const [eligible] = await pool.query(
    `SELECT a.achievement_id, a.achievement_key, a.name, a.description, a.icon, a.threshold
     FROM achievements a
     LEFT JOIN user_achievements ua
       ON ua.achievement_id = a.achievement_id AND ua.user_id = ?
     WHERE a.category = ?
       AND a.threshold <= ?
       AND ua.id IS NULL`,
    [userId, category, currentCount]
  );

  if (eligible.length === 0) return [];

  const values = eligible.map((a) => [userId, a.achievement_id]);
  await pool.query(
    `INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES ?`,
    [values]
  );

  return eligible;
};

// ─── LOGIN STREAK ─────────────────────────────────────────────────────────────
// Call on every successful login. Updates user_streaks and returns any
// newly-earned login_streak achievements alongside the current count.
export const updateLoginStreak = async (userId) => {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const [rows] = await pool.query(
    "SELECT current_streak, longest_streak, last_login_date FROM user_streaks WHERE user_id = ?",
    [userId]
  );

  let currentStreak;
  let longestStreak;

  if (rows.length === 0) {
    currentStreak = 1;
    longestStreak = 1;
    await pool.query(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_login_date)
       VALUES (?, 1, 1, ?)`,
      [userId, today]
    );
  } else {
    const row = rows[0];
    const lastDate = row.last_login_date;

    if (lastDate && sameDay(lastDate, today)) {
      // Already counted today — no change
      currentStreak = row.current_streak;
      longestStreak = row.longest_streak;
    } else if (lastDate && isYesterday(lastDate, today)) {
      currentStreak = row.current_streak + 1;
      longestStreak = Math.max(row.longest_streak, currentStreak);
      await pool.query(
        "UPDATE user_streaks SET current_streak = ?, longest_streak = ?, last_login_date = ? WHERE user_id = ?",
        [currentStreak, longestStreak, today, userId]
      );
    } else {
      // Gap of 2+ days (or no prior date) — reset
      currentStreak = 1;
      longestStreak = row.longest_streak;
      await pool.query(
        "UPDATE user_streaks SET current_streak = ?, last_login_date = ? WHERE user_id = ?",
        [currentStreak, today, userId]
      );
    }
  }

  const newlyEarned = await checkAndAwardAchievements(userId, "login_streak", currentStreak);

  return { currentStreak, longestStreak, newlyEarned };
};

// ─── CHECK-IN STATUS ──────────────────────────────────────────────────────────
// Powers the Homepage "claim today's streak" button. Unlike login streak
// updates (which only fire on the actual /auth/login endpoint, rarely hit
// once a session token is cached), this can be polled any time to see if
// today is already claimed — purely a read, no writes.
export const getCheckinStatus = async (userId) => {
  const [rows] = await pool.query(
    "SELECT current_streak, longest_streak, last_login_date FROM user_streaks WHERE user_id = ?",
    [userId]
  );

  if (rows.length === 0) {
    return { alreadyCheckedIn: false, currentStreak: 0, longestStreak: 0 };
  }

  const today = new Date().toISOString().slice(0, 10);
  const row = rows[0];
  const alreadyCheckedIn = !!(row.last_login_date && sameDay(row.last_login_date, today));

  return {
    alreadyCheckedIn,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
  };
};

// ─── TEAM JOIN ────────────────────────────────────────────────────────────────
// Call when a user's TeamFinder application is finally accepted and they
// become a team_members row. Threshold is always 1 (first team joined).
export const awardTeamJoinAchievement = (userId) =>
  checkAndAwardAchievements(userId, "team", 1);

// ─── NEXUS POST ───────────────────────────────────────────────────────────────
// Call after a community_posts row is inserted. Counts the user's total
// posts and checks post-count thresholds (1st / 10th / 100th, etc).
export const awardNexusPostAchievement = async (userId) => {
  const [[{ count }]] = await pool.query(
    "SELECT COUNT(*) AS count FROM community_posts WHERE user_id = ?",
    [userId]
  );
  return checkAndAwardAchievements(userId, "nexus_post", count);
};

// ─── DNA MATCH ────────────────────────────────────────────────────────────────
// Call after a swipe_matches row is created. Counts the user's total matches
// (as either side of the pair) and checks match-count thresholds.
export const awardDnaMatchAchievement = async (userId) => {
  const [[{ count }]] = await pool.query(
    "SELECT COUNT(*) AS count FROM swipe_matches WHERE user_a_id = ? OR user_b_id = ?",
    [userId, userId]
  );
  return checkAndAwardAchievements(userId, "dna_match", count);
};

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
// Returns everything the Profile page's Achievements tab needs in one call:
// achieved list, locked list (with a live progress count), and streak info.
export const getAchievementsForUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
       a.achievement_id, a.achievement_key, a.name, a.description,
       a.category, a.tier, a.threshold, a.icon,
       ua.earned_at
     FROM achievements a
     LEFT JOIN user_achievements ua
       ON ua.achievement_id = a.achievement_id AND ua.user_id = ?
     ORDER BY a.category, a.tier`,
    [userId]
  );

  const achieved = rows.filter((r) => r.earned_at !== null);
  const lockedRaw = rows.filter((r) => r.earned_at === null);

  // Attach live progress to locked achievements so the UI can show "42/100"
  const progressByCategory = await getProgressCounts(userId);
  const locked = lockedRaw.map((r) => ({
    ...r,
    progress: progressByCategory[r.category] ?? 0,
  }));

  const [streakRows] = await pool.query(
    "SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?",
    [userId]
  );

  return {
    achieved,
    locked,
    streak: streakRows[0] || { current_streak: 0, longest_streak: 0 },
  };
};

const getProgressCounts = async (userId) => {
  const [streakRows] = await pool.query(
    "SELECT current_streak FROM user_streaks WHERE user_id = ?",
    [userId]
  );
  const current_streak = streakRows[0]?.current_streak ?? 0;

  const [[{ postCount }]] = await pool.query(
    "SELECT COUNT(*) AS postCount FROM community_posts WHERE user_id = ?",
    [userId]
  );
  const [[{ matchCount }]] = await pool.query(
    "SELECT COUNT(*) AS matchCount FROM swipe_matches WHERE user_a_id = ? OR user_b_id = ?",
    [userId, userId]
  );
  const [[{ teamCount }]] = await pool.query(
    "SELECT COUNT(*) AS teamCount FROM team_members WHERE user_id = ? AND status = 'active'",
    [userId]
  );

  return {
    login_streak: current_streak,
    nexus_post: postCount,
    dna_match: matchCount,
    team: teamCount,
  };
};

// --- date helpers -------------------------------------------------------------

function sameDay(dateA, isoDateB) {
  return new Date(dateA).toISOString().slice(0, 10) === isoDateB;
}

function isYesterday(dateA, isoDateB) {
  const diffDays = Math.round((new Date(isoDateB) - new Date(dateA)) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
