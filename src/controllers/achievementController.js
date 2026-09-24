import { getAchievementsForUser, getCheckinStatus, updateLoginStreak } from "../services/achievementService.js";

// ─── GET MY ACHIEVEMENTS ──────────────────────────────────────────────────────
// GET /api/achievements/me
// Returns { achieved: [...], locked: [...], streak: { current_streak, longest_streak } }
export const getMyAchievements = async (req, res, next) => {
  try {
    const data = await getAchievementsForUser(req.user.id);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
};

// ─── CHECK-IN STATUS ──────────────────────────────────────────────────────────
// GET /api/achievements/checkin
// Tells the frontend whether to show the "claim today's streak" button.
export const getCheckinStatusHandler = async (req, res, next) => {
  try {
    const data = await getCheckinStatus(req.user.id);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
};

// ─── CLAIM CHECK-IN ───────────────────────────────────────────────────────────
// POST /api/achievements/checkin
// Same underlying logic as the login-triggered streak update, but callable
// any time the user is authenticated — not just when they submit credentials.
export const claimCheckin = async (req, res, next) => {
  try {
    const result = await updateLoginStreak(req.user.id);
    res.json({
      success: true,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      newlyEarnedAchievements: result.newlyEarned,
    });
  } catch (err) { next(err); }
};
