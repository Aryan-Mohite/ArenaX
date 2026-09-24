import pool from "../config/db.js";

// Below this many active users, the homepage should show an
// "MVP · Early Access" badge instead of a fabricated growth number.
const EARLY_ACCESS_THRESHOLD = 100;

// ─── GET PUBLIC PLATFORM STATS ─────────────────────────────────────────────────
// GET /api/platform/stats — no auth, safe to cache briefly on the client.
// Real counts only (no hardcoded copy) so the homepage never claims traction
// the platform doesn't have yet.
export const getPublicStats = async (req, res, next) => {
  try {
    const [
      [activePlayers],
      [tournamentsHosted],
      [teamsAssembled],
      [gamesSupported],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) AS count FROM tournaments WHERE status != 'cancelled'"),
      pool.query("SELECT COUNT(*) AS count FROM teams"),
      pool.query("SELECT COUNT(*) AS count FROM games WHERE status = 'active'"),
    ]);

    const activePlayersCount = Number(activePlayers[0].count);

    res.json({
      success: true,
      stats: {
        activePlayers:      activePlayersCount,
        tournamentsHosted:  Number(tournamentsHosted[0].count),
        teamsAssembled:     Number(teamsAssembled[0].count),
        gamesSupported:     Number(gamesSupported[0].count),
      },
      // Frontend uses this single flag instead of re-deriving the threshold
      // itself, so the "is this real traction yet" call lives in one place.
      isEarlyAccess: activePlayersCount < EARLY_ACCESS_THRESHOLD,
    });
  } catch (err) {
    next(err);
  }
};
